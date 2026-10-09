import { MAX_MINOR, isDate, parseAmountMinor } from '../core/money.ts';
export type Cat = { id: string; name: string; type: 'income' | 'expense' };
export type Acct = { id: string; name: string };
// Zero, empty and negative allowed (opening balances).
export function parseOptionalMinor(s: string): number | null {
  const t = s.trim(); if (t === '') return 0; const neg = t.startsWith('-'), b = neg ? t.slice(1) : t;
  if (/^0+(\.0{0,2})?$/.test(b)) return 0; const m = parseAmountMinor(b); return m === null ? null : neg ? -m : m;
}
export const defaultAccount = (accts: Acct[]) => accts.find(a => a.name.toLowerCase() === 'cash') ?? accts[0];
export type Row = { account_id: string | null; transfer_account_id?: string; category_id: string | null; type: 'income' | 'expense' | 'transfer'; amount_minor: number; description: string; transaction_date: string };
// Client input is untrusted: everything is re-validated against the user's own categories/accounts before any insert.
export function validateItems(items: unknown, v: { categories: Cat[]; accounts: Acct[] }): { ok: true; rows: Row[] } | { ok: false; error: string } {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return { ok: false, error: 'Between 1 and 50 items are required' };
  const rows: Row[] = [], byName = (s: unknown) => (typeof s === 'string' ? v.accounts.find(a => a.name.toLowerCase() === s.toLowerCase()) : undefined);
  for (const [i, x] of (items as any[]).entries()) {
    const n = `Item ${i + 1}: `;
    if (!x || typeof x !== 'object') return { ok: false, error: n + 'invalid' };
    if (x.type !== 'income' && x.type !== 'expense' && x.type !== 'transfer') return { ok: false, error: n + 'invalid type' };
    if (!Number.isSafeInteger(x.amount_minor) || x.amount_minor < 1 || x.amount_minor > MAX_MINOR) return { ok: false, error: n + 'invalid amount' };
    if (typeof x.date !== 'string' || !isDate(x.date)) return { ok: false, error: n + 'invalid date' };
    const description = String(x.description ?? '').slice(0, 120);
    if (x.type === 'transfer') { // both accounts are required and must differ; a transfer has no category
      const from = byName(x.account), to = byName(x.to_account);
      if (!from || !to) return { ok: false, error: n + 'a transfer needs two of your accounts' };
      if (from.id === to.id) return { ok: false, error: n + 'choose two different accounts' };
      rows.push({ account_id: from.id, transfer_account_id: to.id, category_id: null, type: 'transfer', amount_minor: x.amount_minor, description, transaction_date: x.date }); continue;
    }
    const cat = v.categories.find(c => typeof x.category === 'string' && c.name.toLowerCase() === x.category.toLowerCase() && c.type === x.type);
    if (!cat) return { ok: false, error: n + `no ${x.type} category named "${String(x.category).slice(0, 30)}"` };
    const acct = !x.account ? defaultAccount(v.accounts) : byName(x.account);
    if (!acct) return { ok: false, error: n + (x.account ? 'unknown account' : 'create an account first') };
    rows.push({ account_id: acct.id, category_id: cat.id, type: x.type, amount_minor: x.amount_minor, description, transaction_date: x.date });
  }
  return { ok: true, rows };
}
export const minorToInput = (m: number) => (m === 0 ? '' : `${m < 0 ? '-' : ''}${Math.trunc(Math.abs(m) / 100)}.${String(Math.abs(m) % 100).padStart(2, '0')}`);
