// Pure logic for the Reports screen (no React Native, no network) so `npm test` can run it. Money is integer centavos; percentages are integers.
import { totals, type Tx as AggTx } from '../../src/core/aggregate.ts';
import { monthRange, type Category } from './logic.ts';

export type SummaryRow = { type: string; category_id: string | null; total_minor: number | string; n: number | string };
export type MonthRow = { month: number; income_minor: number | string; expense_minor: number | string };
export type CategoryShare = { id: string; name: string; total: number; pct: number };
export type Summary = { income: number; expense: number; net: number; count: number; byCategory: CategoryShare[] };
export type MonthPoint = { month: number; income: number; expense: number };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// bigint columns can arrive as strings; anything unreadable counts as 0 so one bad row never shows NaN.
const minor = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// 'YYYY-MM' moved by `by` months (negative = back). Crosses year boundaries.
export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number);
  const idx = y * 12 + (m - 1) + by;
  const ny = Math.floor(idx / 12);
  return `${ny}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export function monthBounds(ym: string) {
  const r = monthRange(`${ym}-01`);
  return { from: r.from, to: r.to, year: r.year };
}
// Forward arrow limit: up to one month after the current Manila month (planned entries), no further.
// Reports start at January 2000, the earliest date the app accepts anywhere.
export const canGoPrev = (ym: string) => ym > '2000-01';
export const canGoNext = (ym: string, today: string) => shiftMonth(ym, 1) <= shiftMonth(today.slice(0, 7), 1);

// Totals use the website's own rule (aggregate.totals); categories are grouped by id so renamed or duplicate names stay separate.
export function summarize(rows: SummaryRow[], categories: Category[]): Summary {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const real = rows.filter((r) => r.type === 'income' || r.type === 'expense'); // transfers never count
  const t = totals(real.map((r): AggTx => ({ type: r.type as 'income' | 'expense', amount_minor: minor(r.total_minor), date: '' })));
  const sums = new Map<string, CategoryShare>();
  for (const r of real) {
    if (r.type !== 'expense') continue;
    const known = r.category_id !== null && names.has(r.category_id);
    const id = known ? (r.category_id as string) : 'other';
    const cur = sums.get(id) ?? { id, name: known ? (names.get(id) as string) : 'Other', total: 0, pct: 0 };
    cur.total += minor(r.total_minor);
    sums.set(id, cur);
  }
  const byCategory = [...sums.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((x) => ({ ...x, pct: t.expense > 0 ? Math.min(100, Math.round((x.total * 100) / t.expense)) : 0 }));
  return { ...t, count: real.reduce((n, r) => n + minor(r.n), 0), byCategory };
}

// Always 12 entries (Jan..Dec); months with no entries are zeros.
export function yearSeries(rows: MonthRow[]): MonthPoint[] {
  const out: MonthPoint[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
  for (const r of rows) {
    const m = Number(r.month);
    if (!Number.isInteger(m) || m < 1 || m > 12) continue;
    out[m - 1].income += minor(r.income_minor);
    out[m - 1].expense += minor(r.expense_minor);
  }
  return out;
}

// Bar heights as whole percents of the biggest month, so income and expense share one scale.
export function barHeights(series: MonthPoint[]) {
  const max = Math.max(0, ...series.map((p) => Math.max(p.income, p.expense)));
  const h = (v: number) => (max > 0 ? Math.min(100, Math.round((v * 100) / max)) : 0);
  return series.map((p) => ({ income: h(p.income), expense: h(p.expense) }));
}
