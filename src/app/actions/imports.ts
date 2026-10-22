'use server';
import { ctx } from '@/lib/data/data';
import { formatMinor } from '@/core/money';
import { totals, type Tx } from '@/core/aggregate';
import { fromCsv, mapLegacy, type Row } from '@/core/io';
import { defaultAccount } from '@/lib/common/validate';
import { safeMessage } from '@/lib/common/safe';
import { MAX_CSV_BYTES, MAX_CSV_LABEL } from '@/lib/common/limits';
import { go, str, done } from './shared';

// ---- CSV import + localStorage migration
async function resolveAccounts(sb: any, user: any, existing: { id: string; name: string; sort_order?: number }[], names: string[]) {
  const map = new Map(existing.map((a) => [a.name.toLowerCase(), a.id])),
    seen = new Set<string>();
  const fresh = names
    .filter((n) => {
      const k = (n ?? '').toLowerCase();
      if (!n || map.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 20); // "Foo" and "foo" are one account
  if (fresh.length) {
    const { data, error } = await sb
      .from('accounts')
      .insert(
        fresh.map((name, i) => ({
          user_id: user.id,
          name,
          account_type: 'other',
          sort_order: Math.max(0, ...existing.map((a) => Number(a.sort_order ?? 0))) + 10 * (i + 1),
        })),
      )
      .select('id,name');
    if (error) throw error;
    for (const a of data ?? []) map.set(a.name.toLowerCase(), a.id);
  }
  return map;
}

function toDbRows(
  rows: (Row & { import_hash?: string; external_id?: string })[],
  accs: Map<string, string>,
  cats: { id: string; name: string; type: string }[],
  def: string,
  uid: string,
) {
  const out: any[] = [];
  let skipped = 0;
  for (const r of rows) {
    const a = r.account ? accs.get(r.account.toLowerCase()) : def,
      b = r.to_account ? accs.get(r.to_account.toLowerCase()) : undefined;
    const c =
      r.type === 'transfer'
        ? null
        : (cats.find((x) => x.name === r.category && x.type === r.type) ??
          cats.find((x) => x.name === (r.type === 'income' ? 'Other Income' : 'Other') && x.type === r.type));
    if (!a || (r.type === 'transfer' && (!b || a === b)) || (r.type !== 'transfer' && !c)) {
      skipped++;
      continue;
    }
    out.push({
      user_id: uid,
      type: r.type,
      amount_minor: r.amount_minor,
      account_id: a,
      transfer_account_id: r.type === 'transfer' ? b : null,
      category_id: c?.id ?? null,
      description: r.description,
      notes: r.notes,
      transaction_date: r.date,
      import_hash: r.import_hash ?? null,
      external_id: r.external_id ?? null,
    });
  }
  return { out, skipped };
}

const MAX_CSV_ROWS = 20_000;

export async function importCsv(fd: FormData) {
  const { sb, user, accounts, categories } = await ctx();
  const f = fd.get('file');
  if (f instanceof File && f.size > MAX_CSV_BYTES)
    go('/settings', 'err', `That file is too large (max ${MAX_CSV_LABEL}). Split it into smaller files.`);
  const text = f instanceof File && f.size ? await f.text() : str(fd, 'csv');
  if (text.length > MAX_CSV_BYTES) go('/settings', 'err', `That file is too large (max ${MAX_CSV_LABEL}). Split it into smaller files.`);
  const parsed = fromCsv(text, new Set(), {
    income: categories.filter((c) => c.type === 'income').map((c) => c.name),
    expense: categories.filter((c) => c.type === 'expense').map((c) => c.name),
  });
  if (parsed.ok.length > MAX_CSV_ROWS)
    go('/settings', 'err', `Too many rows (${parsed.ok.length}). The limit is ${MAX_CSV_ROWS} per file; split it and import in parts.`);
  let accs: Map<string, string>;
  try {
    accs = await resolveAccounts(
      sb,
      user,
      accounts,
      parsed.ok.flatMap((r) => [r.account, r.to_account]),
    );
  } catch (e) {
    go('/settings', 'err', 'Import stopped: could not create the accounts in the file. ' + safeMessage(e, 'importCsv.accounts'));
  }
  const def = defaultAccount(accounts)?.id ?? [...accs.values()][0];
  const { out, skipped } = toDbRows(parsed.ok, accs, categories, def, user.id);
  let inserted = 0;
  for (let i = 0; i < out.length; i += 500) {
    const { data, error } = await sb
      .from('transactions')
      .upsert(out.slice(i, i + 500), { onConflict: 'user_id,import_hash', ignoreDuplicates: true })
      .select('id');
    if (error) go('/settings', 'err', `Import stopped after ${inserted} rows: ${safeMessage(error, 'importCsv')}`);
    inserted += data?.length ?? 0;
  }
  done();
  go(
    '/settings',
    'ok',
    `Imported ${inserted} new. ${out.length - inserted} matched an earlier import and were skipped. ${parsed.bad.length + skipped} invalid or unmatched rows were ignored. Rows you typed by hand are never compared.`,
  );
}

export async function migrateLegacy(json: string) {
  try {
    const { sb, user, accounts, categories } = await ctx(true);
    let S: unknown;
    try {
      S = JSON.parse(json);
    } catch {
      return { ok: false, message: 'localStorage data is not valid JSON' };
    }
    const m = mapLegacy(S);
    const accs = await resolveAccounts(sb, user, accounts, [
      ...m.rows.flatMap((r) => [r.account, r.to_account]),
      ...Object.keys(m.openings),
    ]);
    for (const [name, minor] of Object.entries(m.openings)) {
      const id = accs.get(name.toLowerCase());
      if (id && minor !== 0) await sb.from('accounts').update({ opening_balance_minor: minor }).eq('id', id).eq('opening_balance_minor', 0);
    }
    const def = defaultAccount(accounts)?.id ?? [...accs.values()][0];
    const { out, skipped } = toDbRows(m.rows, accs, categories, def, user.id);
    let inserted = 0;
    for (let i = 0; i < out.length; i += 500) {
      const { data, error } = await sb
        .from('transactions')
        .upsert(out.slice(i, i + 500), { onConflict: 'user_id,external_id', ignoreDuplicates: true })
        .select('id');
      if (error) return { ok: false, message: safeMessage(error, 'migrateLegacy') };
      inserted += data?.length ?? 0;
    }
    const ids = out.map((o) => o.external_id);
    let inc = 0,
      exp = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await sb
        .from('transactions')
        .select('type,amount_minor')
        .in('external_id', ids.slice(i, i + 200));
      for (const r of data ?? []) {
        if (r.type === 'income') inc += Number(r.amount_minor);
        else if (r.type === 'expense') exp += Number(r.amount_minor);
      }
    }
    const want = totals(out.map((o) => ({ type: o.type, amount_minor: o.amount_minor, date: o.transaction_date }) as Tx));
    const verified = want.income === inc && want.expense === exp;
    done();
    return {
      ok: verified,
      message: `${inserted} new, ${out.length - inserted} already present, ${m.bad.length + skipped} invalid. Totals ${verified ? 'verified' : 'DO NOT MATCH'}: income ${formatMinor(inc)} / expense ${formatMinor(exp)} (expected ${formatMinor(want.income)} / ${formatMinor(want.expense)}).`,
    };
  } catch (e) {
    return { ok: false, message: safeMessage(e, 'migrateLegacy') };
  }
}
