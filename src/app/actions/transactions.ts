'use server';
import { ctx, aliasMap, balanceMap } from '@/lib/data/data';
import { manilaToday, parseAmountMinor, isDate, isSaneDate, formatMinor } from '@/core/money';
import { categoryFor, FEE_CATS, type Parsed } from '@/core/parser';
import { parseWithFallback, getProvider } from '@/ai/provider';
import { validateItems } from '@/lib/common/validate';
import { safeMessage, logErr } from '@/lib/common/safe';
import { commandOf, NOTHING_TO_UNDO } from '@/lib/data/commands';
import { go, str, done, addCategory, type Sb } from './shared';

// ---- quick add (writes only after server-side validation; success is reported only after the rows are re-counted)
type Saved = { ok: true; n: number } | { ok: false; error: string };

export async function saveItems(requestId: string, items: unknown): Promise<Saved> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: 'Not saved: bad request id' };
  try {
    const { sb, user, accounts, categories: have } = await ctx(true);
    let categories = have;
    // Fee categories (Transfer Fee, ATM Fee, ...) are created the first time they are used. Only these exact names can be created this way.
    const wanted = [
      ...new Set(
        (Array.isArray(items) ? items : [])
          .map((x: any) =>
            x && x.type === 'expense' && typeof x.category === 'string'
              ? FEE_CATS.find((f) => f.toLowerCase() === x.category.toLowerCase())
              : undefined,
          )
          .filter(Boolean),
      ),
    ] as string[];
    for (const name of wanted)
      if (!categories.some((c) => c.type === 'expense' && c.name.toLowerCase() === name.toLowerCase())) {
        const r = await addCategory(sb, user.id, name, 'expense');
        if (r.error && (r.error as { code?: string }).code !== '23505')
          return { ok: false, error: 'Not saved: ' + safeMessage(r.error, 'saveItems.fee') };
        if (r.error) categories = (await ctx(true)).categories;
        else categories = [...categories, r.data as any];
      }
    const v = validateItems(items, { categories, accounts });
    if (!v.ok) return { ok: false, error: 'Not saved: ' + v.error };
    const rows = v.rows.map((r, i) => ({ ...r, user_id: user.id, request_id: requestId, request_idx: i }));
    const { error } = await sb.from('transactions').upsert(rows, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true }); // retry-safe
    if (error) return { ok: false, error: 'Not saved: ' + safeMessage(error, 'saveItems') };
    const { count, error: e2 } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('request_id', requestId);
    if (e2) logErr('saveItems.count', e2);
    if (e2 || count !== rows.length) return { ok: false, error: 'Not saved: the database did not confirm the write' };
    done();
    return { ok: true, n: rows.length };
  } catch (e) {
    return { ok: false, error: 'Not saved: ' + safeMessage(e, 'saveItems') };
  }
}

export async function parseServer(text: string, today: string): Promise<Parsed[]> {
  const { sb, accounts, categories } = await ctx(true),
    bal = await balanceMap(sb);
  return parseWithFallback(
    text.slice(0, 500),
    {
      today: isDate(today) ? today : manilaToday(),
      accounts: accounts.map((a) => a.name),
      aliases: aliasMap(accounts),
      balances: Object.fromEntries(accounts.map((a) => [a.name, bal.get(a.id) ?? 0])),
    },
    categories.map((c) => c.name),
    getProvider(process.env),
  );
}

const RESTORE = [
  'id',
  'account_id',
  'transfer_account_id',
  'category_id',
  'type',
  'amount_minor',
  'description',
  'notes',
  'transaction_date',
  'import_hash',
  'external_id',
  'recurring_id',
  'request_id',
  'request_idx',
  'created_at',
];

// Put a deleted transaction back (used by the Undo button and by "undo last"). Takes the server-side copy from the trash when there is one.
async function restoreRow(
  sb: Sb,
  userId: string,
  row: Record<string, unknown>,
): Promise<{ ok: boolean; message: string; permanent?: boolean }> {
  const r: Record<string, unknown> = { user_id: userId };
  for (const k of RESTORE) if (row[k] !== undefined && row[k] !== null) r[k] = row[k];
  if (typeof r.id !== 'string') return { ok: false, message: 'Could not restore that transaction.' };
  if (r.recurring_id) {
    const { data } = await sb
      .from('recurring_transactions')
      .select('id')
      .eq('id', r.recurring_id as string)
      .maybeSingle();
    if (!data) delete r.recurring_id;
  } // the rule was deleted since
  const { error } = await sb.from('transactions').upsert(r, { onConflict: 'id', ignoreDuplicates: true });
  if (error)
    return (error as { code?: string }).code === '23503'
      ? { ok: false, permanent: true, message: "Can't restore it: its account or category was deleted since." }
      : { ok: false, message: safeMessage(error, 'restore') };
  const { count } = await sb
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('id', r.id as string);
  if (count !== 1) return { ok: false, message: 'Could not restore that transaction.' };
  await sb
    .from('tx_trash')
    .delete()
    .eq('tx_id', r.id as string); // best effort: the entry is spent
  return { ok: true, message: 'Restored' };
}

export async function runCommand(text: string): Promise<{ ok: boolean; message: string; deleted?: any }> {
  try {
    const { sb, user, categories } = await ctx(true),
      cmd = commandOf(text),
      t = text.toLowerCase();
    if (!cmd) return { ok: false, message: 'Not a command. Try "delete last", "undo last" or "change last to Food".' };
    if (cmd === 'undo') {
      // restores the most recently deleted transaction; repeating walks back through older deletions
      const { data: tr, error } = await sb.from('tx_trash').select('id,tx_id,row').order('deleted_at', { ascending: false }).limit(20);
      if (error) return { ok: false, message: safeMessage(error, 'undo') };
      if (!tr?.length) return { ok: false, message: NOTHING_TO_UNDO };
      // Newest deletion first. Only a permanent problem (its account or category was deleted since) makes undo skip an entry, and that entry stays in the trash untouched.
      // Any other failure (network, permissions, limits) stops here, so undo never restores things out of order.
      let skipped = 0;
      for (const e of tr) {
        const r = await restoreRow(sb, user.id, e.row as Record<string, unknown>);
        if (r.ok) {
          done();
          const x = e.row as { amount_minor: number; description?: string };
          return {
            ok: true,
            message:
              `Restored ${formatMinor(Number(x.amount_minor))} ${x.description || ''}${skipped ? ` (skipped ${skipped} that can't be restored: their account or category was deleted)` : ''}`.trim(),
          };
        }
        if (!r.permanent) return r;
        skipped++;
      }
      return {
        ok: false,
        message: `Can't undo: the ${skipped} most recent deleted transaction${skipped === 1 ? '' : 's'} belong${skipped === 1 ? 's' : ''} to an account or category that was deleted.`,
      };
    }
    const { data: last, error } = await sb
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .order('request_idx', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(1); // ties (a transfer and its fee share one time) resolve the same way every time
    if (error) return { ok: false, message: safeMessage(error, 'command') };
    if (!last?.length) return { ok: false, message: 'No transactions yet.' };
    const x = last[0];
    if (cmd === 'delete') {
      const { data, error: e } = await sb.from('transactions').delete().eq('id', x.id).select('*');
      if (e || !data?.length) return { ok: false, message: 'Not deleted: ' + (e ? safeMessage(e, 'delete') : 'nothing was removed') };
      done();
      return {
        ok: true,
        message: `Deleted ${formatMinor(Number(x.amount_minor))} ${x.description || ''}`.trim() + '. Type "undo last" to bring it back.',
        deleted: data[0],
      };
    }
    const target = categoryFor(t.split(/\bto\b/).pop() ?? '');
    const cat = target && categories.find((c) => c.name === target.c && c.type === x.type);
    if (!cat)
      return {
        ok: false,
        message:
          x.type === 'transfer'
            ? 'Transfers have no category.'
            : 'Unknown category, or it belongs to the other type. Use Edit to change the type.',
      };
    const { data, error: e } = await sb.from('transactions').update({ category_id: cat.id }).eq('id', x.id).select('id');
    if (e || !data?.length) return { ok: false, message: 'Not updated' };
    done();
    return { ok: true, message: `Changed last transaction to ${cat.name}` };
  } catch (e) {
    return { ok: false, message: safeMessage(e, 'command') };
  }
}

export async function restoreTx(row: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  try {
    const { sb, user } = await ctx(true);
    const id = typeof row?.id === 'string' ? row.id : '';
    const { data: tr } = id
      ? await sb.from('tx_trash').select('row').eq('tx_id', id).order('deleted_at', { ascending: false }).limit(1)
      : { data: null };
    const r = await restoreRow(sb, user.id, (tr?.[0]?.row as Record<string, unknown> | undefined) ?? row);
    if (r.ok) done();
    return r;
  } catch (e) {
    return { ok: false, message: safeMessage(e, 'restoreTx') };
  }
}

export async function deleteTx(id: string) {
  try {
    const { sb } = await ctx(true);
    const { data, error } = await sb.from('transactions').delete().eq('id', id).select('*');
    if (error || !data?.length)
      return { ok: false as const, message: 'Not deleted: ' + (error ? safeMessage(error, 'deleteTx') : 'it no longer exists') };
    done(); // refreshes the list and drops every remembered screen; the Undo notice lives in the app layout (UndoBar), so it survives this
    return { ok: true as const, row: data[0] };
  } catch (e) {
    return { ok: false as const, message: 'Not deleted: ' + safeMessage(e, 'deleteTx') };
  }
}

export async function duplicateTx(id: string) {
  try {
    const { sb, user } = await ctx(true);
    const { data } = await sb.from('transactions').select('*').eq('id', id).single();
    if (!data) return { ok: false, message: 'Not found' };
    const r: Record<string, unknown> = { user_id: user.id };
    for (const k of RESTORE)
      if (!['id', 'import_hash', 'external_id', 'recurring_id', 'request_id', 'request_idx', 'created_at'].includes(k)) r[k] = data[k];
    const { error } = await sb.from('transactions').insert(r);
    if (error) return { ok: false, message: safeMessage(error, 'duplicateTx') };
    done();
    return { ok: true, message: 'Duplicated' };
  } catch (e) {
    return { ok: false, message: safeMessage(e, 'duplicateTx') };
  }
}

export async function updateTx(fd: FormData) {
  const id = str(fd, 'id'),
    back = `/transactions/${encodeURIComponent(id)}`,
    { sb, categories, accounts } = await ctx();
  const amt = parseAmountMinor(str(fd, 'amount')),
    date = str(fd, 'date'),
    type = str(fd, 'type');
  if (amt === null) go(back, 'err', 'Amount must be 0.01 to 999,999,999.99');
  if (!isSaneDate(date)) go(back, 'err', 'Invalid date (use a real date between 2000 and 5 years from now)');
  if (!accounts.some((a) => a.id === str(fd, 'account_id'))) go(back, 'err', 'Unknown account');
  const patch: Record<string, unknown> = {
    amount_minor: amt,
    transaction_date: date,
    description: str(fd, 'description').slice(0, 120),
    notes: str(fd, 'notes').slice(0, 500),
    account_id: str(fd, 'account_id'),
    type,
  };
  if (type === 'transfer') {
    if (!accounts.some((a) => a.id === str(fd, 'to_id'))) go(back, 'err', 'Unknown destination account');
    patch.transfer_account_id = str(fd, 'to_id');
    patch.category_id = null;
  } else {
    const c = categories.find((c) => c.id === str(fd, 'category_id'));
    if ((type !== 'income' && type !== 'expense') || !c || c.type !== type) go(back, 'err', 'Category does not match the type');
    patch.category_id = c.id;
    patch.transfer_account_id = null;
  }
  const { data, error } = await sb.from('transactions').update(patch).eq('id', id).select('id');
  if (error || !data?.length)
    go(back, 'err', 'Not saved: ' + (error ? safeMessage(error, 'updateTx') : 'that transaction no longer exists'));
  done();
  go('/transactions', 'ok', 'Saved');
}
