import { parseAmountMinor, isDate } from './money.ts';
import { INC, EXP } from './parser.ts';
export function csvParse(s: string): string[][] {
  const rows: string[][] = []; let r: string[] = [], f = '', q = false; s = s.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; } else f += c; }
  if (f !== '' || r.length) { r.push(f); rows.push(r); }
  return rows.filter(r => r.some(v => v.trim()));
}
export const csvCell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
const unguard = (v = '') => v.replace(/^'(?=[=+\-@\t\r])/, '');
export type Row = { date: string; type: 'income' | 'expense' | 'transfer'; amount_minor: number; category: string; description: string; notes: string; account: string; to_account: string };
export const fmt = (m: number) => `${Math.trunc(m / 100)}.${String(m % 100).padStart(2, '0')}`;
export const toCsv = (rows: Row[]) => ['date,type,amount,category,description,notes,account,to_account', ...rows.map(r => [r.date, r.type, fmt(r.amount_minor), r.category, r.description, r.notes, r.account, r.to_account].map(csvCell).join(','))].join('\n');
// Dedupe key. Identical rows inside one file are legitimate (two ₱120 lunches), so each key carries an occurrence index.
export const rowKey = (r: Row) => [r.date, r.type, r.amount_minor, r.account, r.to_account, r.description.trim().toLowerCase()].join('|');
export function withKeys<T extends Row>(rows: T[]) { const n = new Map<string, number>(); return rows.map(r => { const k = rowKey(r), i = n.get(k) ?? 0; n.set(k, i + 1); return { ...r, import_hash: `${k}#${i}` }; }); }
export function fromCsv(text: string, existingHashes: Set<string> = new Set(), extra: { income: string[]; expense: string[] } = { income: [], expense: [] }) {
  const rows = csvParse(text); if (rows.length && /date/i.test(rows[0][0] ?? '')) rows.shift();
  const good: Row[] = [], bad: number[] = [];
  rows.forEach((c, k) => {
    const type = (c[1] ?? '').toLowerCase() as Row['type'], amt = parseAmountMinor(c[2] ?? '');
    if (!isDate(c[0] ?? '') || !['income', 'expense', 'transfer'].includes(type) || amt === null) { bad.push(k + 1); return; }
    let category = unguard(c[3]); if (type === 'transfer') category = 'Transfer'; else if (!(type === 'income' ? [...INC, ...extra.income] : [...EXP, ...extra.expense]).includes(category)) category = type === 'income' ? 'Other Income' : 'Other';
    good.push({ date: c[0], type, amount_minor: amt, category, description: unguard(c[4]).slice(0, 120), notes: unguard(c[5]).slice(0, 500), account: unguard(c[6]).slice(0, 40), to_account: type === 'transfer' ? unguard(c[7]).slice(0, 40) : '' });
  });
  const keyed = withKeys(good), ok = keyed.filter(r => !existingHashes.has(r.import_hash));
  return { ok, bad, dup: keyed.length - ok.length };
}
// Legacy prototype (localStorage "mt1") -> rows with integer minor units. external_id makes the migration idempotent.
const legacyMinor = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? parseAmountMinor(Math.abs(n).toFixed(2)) : null; };
export function mapLegacy(s: any) {
  const rows: (Row & { external_id: string })[] = [], bad: string[] = [];
  for (const x of s?.tx ?? []) {
    const amt = legacyMinor(x.amount);
    if (amt === null || !isDate(x.date) || !['income', 'expense', 'transfer'].includes(x.type)) { bad.push(`legacy:${x?.id}`); continue; }
    rows.push({ external_id: `legacy:${x.id}`, date: x.date, type: x.type, amount_minor: amt, category: x.cat, description: x.desc ?? '', notes: x.notes ?? '', account: x.acct ?? '', to_account: x.to ?? '' });
  }
  const openings: Record<string, number> = {};
  for (const [a, v] of Object.entries(s?.open ?? {})) { const m = legacyMinor(v); openings[a] = m === null ? 0 : (v as number) < 0 ? -m : m; }
  return { rows, bad, openings };
}
