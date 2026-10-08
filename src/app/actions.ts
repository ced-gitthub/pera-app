'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { ctx } from '@/lib/data';
import { manilaToday, parseAmountMinor, isDate, formatMinor } from '@/core/money';
import { categoryFor, type Parsed } from '@/core/parser';
import { totals, type Tx } from '@/core/aggregate';
import { fromCsv, mapLegacy, type Row } from '@/core/io';
import { parseWithFallback, getProvider } from '@/ai/provider';
import { validateItems, parseOptionalMinor, defaultAccount } from '@/lib/validate';
import { parseQuestion } from '@/lib/assistant';
import { safeMessage, authMessage, logErr } from '@/lib/safe';
import { MAX_CSV_BYTES, MAX_CSV_LABEL } from '@/lib/limits';
import { commandOf, NOTHING_TO_UNDO } from '@/lib/commands';

function go(path: string, k: 'err' | 'ok', m: string): never { redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(m.slice(0, 200))}`); }
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const done = () => revalidatePath('/', 'layout');

// ---- auth
export async function signIn(fd: FormData) {
  const sb = await supabaseServer(); const { error } = await sb.auth.signInWithPassword({ email: str(fd, 'email'), password: str(fd, 'password') });
  if (error) go('/login', 'err', authMessage(error, 'signIn')); redirect('/');
}
export async function signUp(fd: FormData) {
  const sb = await supabaseServer(); const { data, error } = await sb.auth.signUp({ email: str(fd, 'email'), password: str(fd, 'password'), options: { data: { name: str(fd, 'name').slice(0, 60) } } });
  if (error) go('/register', 'err', authMessage(error, 'signUp')); if (!data.session) go('/login', 'ok', 'Account created. Confirm your email, then sign in.'); redirect('/');
}
// ---- password recovery (the reply never reveals whether an email has an account)
export async function requestReset(fd: FormData) {
  const email = str(fd, 'email').trim().slice(0, 254); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) go('/forgot', 'err', 'Enter a valid email address.');
  const h = await headers(), site = process.env.NEXT_PUBLIC_SITE_URL || h.get('origin') || `https://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'}`;
  const sb = await supabaseServer(); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${site.replace(/\/$/, '')}/auth/callback?next=/reset` });
  if (error && /rate_limit/.test((error as { code?: string }).code ?? '')) go('/forgot', 'err', authMessage(error, 'requestReset')); if (error) logErr('requestReset', error);
  go('/forgot', 'ok', 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.');
}
export async function updatePassword(fd: FormData) {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) go('/forgot', 'err', 'That link is invalid or has expired. Request a new one.');
  const p = str(fd, 'password'), c = str(fd, 'confirm'); if (p.length < 6 || p.length > 72) go('/reset', 'err', 'Use a password of 6 to 72 characters.'); if (p !== c) go('/reset', 'err', 'The two passwords do not match.');
  const { error } = await sb.auth.updateUser({ password: p }); if (error) go('/reset', 'err', authMessage(error, 'updatePassword'));
  await sb.auth.signOut(); go('/login', 'ok', 'Password updated. Log in with your new password.');
}
export async function signOut() { const sb = await supabaseServer(); await sb.auth.signOut(); redirect('/login'); }

// ---- quick add (writes only after server-side validation; success is reported only after the rows are re-counted)
type Saved = { ok: true; n: number } | { ok: false; error: string };
export async function saveItems(requestId: string, items: unknown): Promise<Saved> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: 'Not saved: bad request id' };
  try {
    const { sb, user, accounts, categories } = await ctx(true); const v = validateItems(items, { categories, accounts }); if (!v.ok) return { ok: false, error: 'Not saved: ' + v.error };
    const rows = v.rows.map((r, i) => ({ ...r, user_id: user.id, request_id: requestId, request_idx: i }));
    const { error } = await sb.from('transactions').upsert(rows, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true }); // retry-safe
    if (error) return { ok: false, error: 'Not saved: ' + safeMessage(error, 'saveItems') };
    const { count, error: e2 } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('request_id', requestId);
    if (e2) logErr('saveItems.count', e2); if (e2 || count !== rows.length) return { ok: false, error: 'Not saved: the database did not confirm the write' };
    done(); return { ok: true, n: rows.length };
  } catch (e) { return { ok: false, error: 'Not saved: ' + safeMessage(e, 'saveItems') }; }
}
export async function parseServer(text: string, today: string): Promise<Parsed[]> {
  const { accounts, categories } = await ctx(true);
  return parseWithFallback(text.slice(0, 500), { today: isDate(today) ? today : manilaToday(), accounts: accounts.map(a => a.name) }, categories.map(c => c.name), getProvider(process.env));
}
const RESTORE = ['id', 'account_id', 'transfer_account_id', 'category_id', 'type', 'amount_minor', 'description', 'notes', 'transaction_date', 'import_hash', 'external_id', 'recurring_id', 'request_id', 'request_idx', 'created_at'];
type Sb = Awaited<ReturnType<typeof ctx>>['sb'];
// Put a deleted transaction back (used by the Undo button and by "undo last"). Takes the server-side copy from the trash when there is one.
async function restoreRow(sb: Sb, userId: string, row: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  const r: Record<string, unknown> = { user_id: userId }; for (const k of RESTORE) if (row[k] !== undefined && row[k] !== null) r[k] = row[k];
  if (typeof r.id !== 'string') return { ok: false, message: 'Could not restore that transaction.' };
  if (r.recurring_id) { const { data } = await sb.from('recurring_transactions').select('id').eq('id', r.recurring_id as string).maybeSingle(); if (!data) delete r.recurring_id; } // the rule was deleted since
  const { error } = await sb.from('transactions').upsert(r, { onConflict: 'id', ignoreDuplicates: true });
  if (error) return { ok: false, message: (error as { code?: string }).code === '23503' ? "Can't restore it: its account or category was deleted since." : safeMessage(error, 'restore') };
  const { count } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('id', r.id as string); if (count !== 1) return { ok: false, message: 'Could not restore that transaction.' };
  await sb.from('tx_trash').delete().eq('tx_id', r.id as string); // best effort: the entry is spent
  return { ok: true, message: 'Restored' };
}
export async function runCommand(text: string): Promise<{ ok: boolean; message: string; deleted?: any }> {
  try {
    const { sb, user, categories } = await ctx(true), cmd = commandOf(text), t = text.toLowerCase();
    if (!cmd) return { ok: false, message: 'Not a command. Try "delete last", "undo last" or "change last to Food".' };
    if (cmd === 'undo') { // restores the most recently deleted transaction; repeating walks back through older deletions
      const { data: tr, error } = await sb.from('tx_trash').select('id,tx_id,row').order('deleted_at', { ascending: false }).limit(1); if (error) return { ok: false, message: safeMessage(error, 'undo') };
      if (!tr?.length) return { ok: false, message: NOTHING_TO_UNDO };
      const r = await restoreRow(sb, user.id, tr[0].row as Record<string, unknown>); await sb.from('tx_trash').delete().eq('id', tr[0].id); // an unrestorable entry is dropped so undo never gets stuck on it
      if (!r.ok) return r; done(); const x = tr[0].row as { amount_minor: number; description?: string };
      return { ok: true, message: `Restored ${formatMinor(Number(x.amount_minor))} ${x.description || ''}`.trim() };
    }
    const { data: last, error } = await sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(1);
    if (error) return { ok: false, message: safeMessage(error, 'command') }; if (!last?.length) return { ok: false, message: 'No transactions yet.' };
    const x = last[0];
    if (cmd === 'delete') {
      const { data, error: e } = await sb.from('transactions').delete().eq('id', x.id).select('*'); if (e || !data?.length) return { ok: false, message: 'Not deleted: ' + (e ? safeMessage(e, 'delete') : 'nothing was removed') };
      done(); return { ok: true, message: `Deleted ${formatMinor(Number(x.amount_minor))} ${x.description || ''}`.trim() + '. Type "undo last" to bring it back.', deleted: data[0] };
    }
    const target = categoryFor(t.split(/\bto\b/).pop() ?? ''); const cat = target && categories.find(c => c.name === target.c && c.type === x.type);
    if (!cat) return { ok: false, message: x.type === 'transfer' ? 'Transfers have no category.' : 'Unknown category, or it belongs to the other type. Use Edit to change the type.' };
    const { data, error: e } = await sb.from('transactions').update({ category_id: cat.id }).eq('id', x.id).select('id'); if (e || !data?.length) return { ok: false, message: 'Not updated' };
    done(); return { ok: true, message: `Changed last transaction to ${cat.name}` };
  } catch (e) { return { ok: false, message: safeMessage(e, 'command') }; }
}
export async function restoreTx(row: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  try { const { sb, user } = await ctx(true); const id = typeof row?.id === 'string' ? row.id : '';
    const { data: tr } = id ? await sb.from('tx_trash').select('row').eq('tx_id', id).order('deleted_at', { ascending: false }).limit(1) : { data: null };
    const r = await restoreRow(sb, user.id, (tr?.[0]?.row as Record<string, unknown> | undefined) ?? row); if (r.ok) done(); return r;
  } catch (e) { return { ok: false, message: safeMessage(e, 'restoreTx') }; }
}
export async function deleteTx(id: string) {
  try { const { sb } = await ctx(true); const { data, error } = await sb.from('transactions').delete().eq('id', id).select('*');
    if (error || !data?.length) return { ok: false as const, message: 'Not deleted: ' + (error ? safeMessage(error, 'deleteTx') : 'it no longer exists') }; /* no revalidate here: it would refresh the list and unmount the row's Undo prompt; pages are dynamic, so the next navigation is fresh */ return { ok: true as const, row: data[0] };
  } catch (e) { return { ok: false as const, message: 'Not deleted: ' + safeMessage(e, 'deleteTx') }; }
}
export async function duplicateTx(id: string) {
  try { const { sb, user } = await ctx(true); const { data } = await sb.from('transactions').select('*').eq('id', id).single(); if (!data) return { ok: false, message: 'Not found' };
    const r: Record<string, unknown> = { user_id: user.id }; for (const k of RESTORE) if (!['id', 'import_hash', 'external_id', 'recurring_id', 'request_id', 'request_idx', 'created_at'].includes(k)) r[k] = data[k];
    const { error } = await sb.from('transactions').insert(r); if (error) return { ok: false, message: safeMessage(error, 'duplicateTx') }; done(); return { ok: true, message: 'Duplicated' };
  } catch (e) { return { ok: false, message: safeMessage(e, 'duplicateTx') }; }
}
export async function updateTx(fd: FormData) {
  const id = str(fd, 'id'), back = `/transactions/${encodeURIComponent(id)}`, { sb, categories, accounts } = await ctx();
  const amt = parseAmountMinor(str(fd, 'amount')), date = str(fd, 'date'), type = str(fd, 'type');
  if (amt === null) go(back, 'err', 'Amount must be 0.01 to 999,999,999.99'); if (!isDate(date)) go(back, 'err', 'Invalid date');
  if (!accounts.some(a => a.id === str(fd, 'account_id'))) go(back, 'err', 'Unknown account');
  const patch: Record<string, unknown> = { amount_minor: amt, transaction_date: date, description: str(fd, 'description').slice(0, 120), notes: str(fd, 'notes').slice(0, 500), account_id: str(fd, 'account_id'), type };
  if (type === 'transfer') { if (!accounts.some(a => a.id === str(fd, 'to_id'))) go(back, 'err', 'Unknown destination account'); patch.transfer_account_id = str(fd, 'to_id'); patch.category_id = null; }
  else { const c = categories.find(c => c.id === str(fd, 'category_id')); if ((type !== 'income' && type !== 'expense') || !c || c.type !== type) go(back, 'err', 'Category does not match the type'); patch.category_id = c.id; patch.transfer_account_id = null; }
  const { data, error } = await sb.from('transactions').update(patch).eq('id', id).select('id'); if (error || !data?.length) go(back, 'err', 'Not saved: ' + (error ? safeMessage(error, 'updateTx') : 'that transaction no longer exists')); done(); go('/transactions', 'ok', 'Saved');
}
// ---- accounts / transfers / categories / budgets / recurring / profile
export async function createAccount(fd: FormData) {
  const { sb, user } = await ctx(); const open = parseOptionalMinor(str(fd, 'opening')); const name = str(fd, 'name').trim().slice(0, 40);
  if (!name || open === null) go('/accounts', 'err', 'Name and a valid opening balance are required');
  const { error } = await sb.from('accounts').insert({ user_id: user.id, name, account_type: str(fd, 'type') || 'other', opening_balance_minor: open }); if (error) go('/accounts', 'err', safeMessage(error, 'createAccount')); done(); go('/accounts', 'ok', 'Account created');
}
export async function updateAccount(fd: FormData) {
  const { sb } = await ctx(); const open = parseOptionalMinor(str(fd, 'opening')); const name = str(fd, 'name').trim().slice(0, 40); if (!name || open === null) go('/accounts', 'err', 'Invalid name or opening balance');
  const { error } = await sb.from('accounts').update({ name, account_type: str(fd, 'type'), opening_balance_minor: open }).eq('id', str(fd, 'id')); if (error) go('/accounts', 'err', safeMessage(error, 'updateAccount')); done(); go('/accounts', 'ok', 'Account saved');
}
export async function deleteAccount(fd: FormData) {
  const { sb } = await ctx(); const { error } = await sb.from('accounts').delete().eq('id', str(fd, 'id')); if (error) go('/accounts', 'err', 'Cannot delete: it is used by transactions (move or delete them first)'); done(); go('/accounts', 'ok', 'Account deleted');
}
export async function transfer(fd: FormData) {
  const { sb, user } = await ctx(); const amt = parseAmountMinor(str(fd, 'amount')), date = str(fd, 'date') || manilaToday(), a = str(fd, 'from'), b = str(fd, 'to');
  if (amt === null || !isDate(date) || !a || !b || a === b) go('/accounts', 'err', 'Choose two different accounts and a valid amount/date');
  const { error } = await sb.from('transactions').insert({ user_id: user.id, type: 'transfer', amount_minor: amt, account_id: a, transfer_account_id: b, transaction_date: date, description: str(fd, 'description').slice(0, 120) });
  if (error) go('/accounts', 'err', 'Not saved: ' + safeMessage(error, 'transfer')); done(); go('/accounts', 'ok', 'Transfer recorded');
}
export async function createCategory(fd: FormData) {
  const { sb, user } = await ctx(); const name = str(fd, 'name').trim().slice(0, 40), type = str(fd, 'type'); if (!name || (type !== 'income' && type !== 'expense')) go('/settings', 'err', 'Name and type required');
  const { error } = await sb.from('categories').insert({ user_id: user.id, name, type }); if (error) go('/settings', 'err', safeMessage(error, 'createCategory')); done(); go('/settings', 'ok', 'Category added');
}
export async function deleteCategory(fd: FormData) {
  const { sb } = await ctx(); const { error } = await sb.from('categories').delete().eq('id', str(fd, 'id')); if (error) go('/settings', 'err', 'Cannot delete: category is in use'); done(); go('/settings', 'ok', 'Category deleted');
}
export async function setBudget(fd: FormData) {
  const { sb, user } = await ctx(); const ym = str(fd, 'ym'), back = `/budgets?ym=${ym}`; if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) go('/budgets', 'err', 'Bad month');
  const [year, month] = ym.split('-').map(Number), cat = str(fd, 'category_id'), raw = str(fd, 'amount').trim();
  if (raw === '') { await sb.from('budgets').delete().eq('category_id', cat).eq('month', month).eq('year', year); done(); go(back, 'ok', 'Budget removed'); }
  const amt = parseOptionalMinor(raw); if (amt === null || amt < 0) go(back, 'err', 'Invalid budget amount');
  const { error } = await sb.from('budgets').upsert({ user_id: user.id, category_id: cat, amount_minor: amt, month, year }, { onConflict: 'user_id,category_id,month,year' }); if (error) go(back, 'err', safeMessage(error, 'setBudget')); done(); go(back, 'ok', 'Budget saved');
}
export async function createRecurring(fd: FormData) {
  const { sb, user, categories, accounts } = await ctx(); const amt = parseAmountMinor(str(fd, 'amount')), start = str(fd, 'start'), n = Number(str(fd, 'interval') || 1), type = str(fd, 'type');
  const cat = categories.find(c => c.id === str(fd, 'category_id') && c.type === type), acct = accounts.find(a => a.id === str(fd, 'account_id'));
  if (amt === null || !isDate(start) || !cat || !acct || !Number.isInteger(n) || n < 1 || n > 365 || !['daily', 'weekly', 'monthly', 'yearly'].includes(str(fd, 'frequency'))) go('/settings', 'err', 'Check amount, start date, type/category, account and interval');
  const { error } = await sb.from('recurring_transactions').insert({ user_id: user.id, account_id: acct.id, category_id: cat.id, type, amount_minor: amt, description: str(fd, 'description').slice(0, 120), frequency: str(fd, 'frequency'), interval_count: n, start_date: start, next_run_date: start });
  if (error) go('/settings', 'err', safeMessage(error, 'createRecurring')); done(); go('/settings', 'ok', 'Recurring rule added (runs when you open the dashboard)');
}
export async function deleteRecurring(fd: FormData) { const { sb } = await ctx(); const { error } = await sb.from('recurring_transactions').delete().eq('id', str(fd, 'id')); if (error) go('/settings', 'err', 'Could not delete that rule. ' + safeMessage(error, 'deleteRecurring')); done(); go('/settings', 'ok', 'Rule deleted (past transactions kept)'); }
export async function updateProfile(fd: FormData) { const { sb, user } = await ctx(); const { error } = await sb.from('profiles').update({ name: str(fd, 'name').slice(0, 60) }).eq('id', user.id); if (error) go('/settings', 'err', safeMessage(error, 'updateProfile')); go('/settings', 'ok', 'Profile saved'); }
// ---- assistant: fixed read-only queries -> numbers computed by SQL -> text. A provider (if any) may only reword the numbers.
export async function askAssistant(q: string): Promise<{ ok: boolean; answer: string }> {
  try {
    const { sb, accounts, categories } = await ctx(true); const Q = parseQuestion(q.slice(0, 300), { categories, accounts, today: manilaToday() }); const scope = `${Q.categoryName ? ' on ' + Q.categoryName : ''}${Q.accountName ? ' through ' + Q.accountName : ''}`;
    const must = <T,>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; }; // a failed query must never become a confident wrong number
    const sum = async (from: string, to: string) => Number(must(await sb.rpc('sum_expense', { p_from: from, p_to: to, p_category: Q.categoryId ?? null, p_account: Q.accountId ?? null })) ?? 0);
    const cn = new Map(categories.map(c => [c.id, c.name])); let answer = 'I can answer spending, income, savings, top category, biggest expenses and month comparisons.';
    if (Q.kind === 'spend') answer = `You spent ${formatMinor(await sum(Q.from, Q.to))}${scope} ${Q.label}.`;
    else if (Q.kind === 'compare') { const p = periodFor2(); const a = await sum(p.cur.from, p.cur.to), b = await sum(p.prev.from, p.prev.to); answer = `Spending${scope}: ${formatMinor(a)} this month vs ${formatMinor(b)} last month — ${formatMinor(Math.abs(a - b))} ${a >= b ? 'more' : 'less'}.`; }
    else if (Q.kind === 'income' || Q.kind === 'save' || Q.kind === 'top') {
      const data = must(await sb.rpc('period_summary', { p_from: Q.from, p_to: Q.to })); const txs: Tx[] = (data as any[] ?? []).map(x => ({ type: x.type, amount_minor: Number(x.total_minor), category: cn.get(x.category_id) ?? 'Other', date: Q.from })); const t = totals(txs);
      if (Q.kind === 'income') answer = `Income ${Q.label}: ${formatMinor(t.income)}.`; else if (Q.kind === 'save') answer = `Income ${formatMinor(t.income)} − expenses ${formatMinor(t.expense)} = saved ${formatMinor(t.net)} ${Q.label}.`;
      else { const top = txs.filter(x => x.type === 'expense').sort((a, b) => b.amount_minor - a.amount_minor)[0]; answer = top ? `Top spending category ${Q.label}: ${top.category} at ${formatMinor(top.amount_minor)}.` : `No expenses ${Q.label}.`; }
    } else if (Q.kind === 'biggest') {
      const data = must(await sb.from('transactions').select('amount_minor,description,transaction_date,category_id').eq('type', 'expense').gte('transaction_date', Q.from).lte('transaction_date', Q.to).order('amount_minor', { ascending: false }).limit(5));
      answer = data?.length ? `Biggest expenses ${Q.label}: ` + data.map((d: any) => `${formatMinor(Number(d.amount_minor))} ${cn.get(d.category_id) ?? ''}${d.description ? ' (' + d.description + ')' : ''}`).join('; ') : `No expenses ${Q.label}.`;
    }
    const p = getProvider(process.env); if (p) { try { answer = await p.answerFinancialQuestion(q, { computed_answer: answer }) || answer; } catch { /* keep the computed answer */ } }
    return { ok: true, answer };
  } catch (e) { return { ok: false, answer: safeMessage(e, 'askAssistant') }; }
}
import { periodFor, shiftYm, monthRange } from '@/lib/range';
function periodFor2() { const ym = manilaToday().slice(0, 7); return { cur: periodFor('month', manilaToday()), prev: monthRange(shiftYm(ym, -1)) }; }
// ---- CSV import + localStorage migration
async function resolveAccounts(sb: any, user: any, existing: { id: string; name: string }[], names: string[]) {
  const map = new Map(existing.map(a => [a.name.toLowerCase(), a.id])); const fresh = [...new Set(names.filter(n => n && !map.has(n.toLowerCase())))].slice(0, 20);
  if (fresh.length) { const { data } = await sb.from('accounts').insert(fresh.map(name => ({ user_id: user.id, name, account_type: 'other' }))).select('id,name'); for (const a of data ?? []) map.set(a.name.toLowerCase(), a.id); }
  return map;
}
function toDbRows(rows: (Row & { import_hash?: string; external_id?: string })[], accs: Map<string, string>, cats: { id: string; name: string; type: string }[], def: string, uid: string) {
  const out: any[] = []; let skipped = 0;
  for (const r of rows) {
    const a = r.account ? accs.get(r.account.toLowerCase()) : def, b = r.to_account ? accs.get(r.to_account.toLowerCase()) : undefined;
    const c = r.type === 'transfer' ? null : cats.find(x => x.name === r.category && x.type === r.type) ?? cats.find(x => x.name === (r.type === 'income' ? 'Other Income' : 'Other') && x.type === r.type);
    if (!a || (r.type === 'transfer' && (!b || a === b)) || (r.type !== 'transfer' && !c)) { skipped++; continue; }
    out.push({ user_id: uid, type: r.type, amount_minor: r.amount_minor, account_id: a, transfer_account_id: r.type === 'transfer' ? b : null, category_id: c?.id ?? null, description: r.description, notes: r.notes, transaction_date: r.date, import_hash: r.import_hash ?? null, external_id: r.external_id ?? null });
  }
  return { out, skipped };
}
const MAX_CSV_ROWS = 20_000;
export async function importCsv(fd: FormData) {
  const { sb, user, accounts, categories } = await ctx(); const f = fd.get('file'); if (f instanceof File && f.size > MAX_CSV_BYTES) go('/settings', 'err', `That file is too large (max ${MAX_CSV_LABEL}). Split it into smaller files.`); const text = f instanceof File && f.size ? await f.text() : str(fd, 'csv'); if (text.length > MAX_CSV_BYTES) go('/settings', 'err', `That file is too large (max ${MAX_CSV_LABEL}). Split it into smaller files.`);
  const parsed = fromCsv(text, new Set(), { income: categories.filter(c => c.type === 'income').map(c => c.name), expense: categories.filter(c => c.type === 'expense').map(c => c.name) });
  if (parsed.ok.length > MAX_CSV_ROWS) go('/settings', 'err', `Too many rows (${parsed.ok.length}). The limit is ${MAX_CSV_ROWS} per file; split it and import in parts.`);
  const accs = await resolveAccounts(sb, user, accounts, parsed.ok.flatMap(r => [r.account, r.to_account])), def = defaultAccount(accounts)?.id ?? [...accs.values()][0];
  const { out, skipped } = toDbRows(parsed.ok, accs, categories, def, user.id); let inserted = 0;
  for (let i = 0; i < out.length; i += 500) { const { data, error } = await sb.from('transactions').upsert(out.slice(i, i + 500), { onConflict: 'user_id,import_hash', ignoreDuplicates: true }).select('id'); if (error) go('/settings', 'err', `Import stopped after ${inserted} rows: ${safeMessage(error, 'importCsv')}`); inserted += data?.length ?? 0; }
  done(); go('/settings', 'ok', `Imported ${inserted} new. ${out.length - inserted} matched an earlier import and were skipped. ${parsed.bad.length + skipped} invalid or unmatched rows were ignored. Rows you typed by hand are never compared.`);
}
export async function migrateLegacy(json: string) {
  try {
    const { sb, user, accounts, categories } = await ctx(true); let S: unknown; try { S = JSON.parse(json); } catch { return { ok: false, message: 'localStorage data is not valid JSON' }; }
    const m = mapLegacy(S); const accs = await resolveAccounts(sb, user, accounts, [...m.rows.flatMap(r => [r.account, r.to_account]), ...Object.keys(m.openings)]);
    for (const [name, minor] of Object.entries(m.openings)) { const id = accs.get(name.toLowerCase()); if (id && minor !== 0) await sb.from('accounts').update({ opening_balance_minor: minor }).eq('id', id).eq('opening_balance_minor', 0); }
    const def = defaultAccount(accounts)?.id ?? [...accs.values()][0]; const { out, skipped } = toDbRows(m.rows, accs, categories, def, user.id); let inserted = 0;
    for (let i = 0; i < out.length; i += 500) { const { data, error } = await sb.from('transactions').upsert(out.slice(i, i + 500), { onConflict: 'user_id,external_id', ignoreDuplicates: true }).select('id'); if (error) return { ok: false, message: safeMessage(error, 'migrateLegacy') }; inserted += data?.length ?? 0; }
    const ids = out.map(o => o.external_id); let inc = 0, exp = 0;
    for (let i = 0; i < ids.length; i += 200) { const { data } = await sb.from('transactions').select('type,amount_minor').in('external_id', ids.slice(i, i + 200)); for (const r of data ?? []) { if (r.type === 'income') inc += Number(r.amount_minor); else if (r.type === 'expense') exp += Number(r.amount_minor); } }
    const want = totals(out.map(o => ({ type: o.type, amount_minor: o.amount_minor, date: o.transaction_date }) as Tx)); const verified = want.income === inc && want.expense === exp; done();
    return { ok: verified, message: `${inserted} new, ${out.length - inserted} already present, ${m.bad.length + skipped} invalid. Totals ${verified ? 'verified' : 'DO NOT MATCH'}: income ${formatMinor(inc)} / expense ${formatMinor(exp)} (expected ${formatMinor(want.income)} / ${formatMinor(want.expense)}).` };
  } catch (e) { return { ok: false, message: safeMessage(e, 'migrateLegacy') }; }
}
