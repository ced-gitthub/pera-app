// Pure logic for recurring rules (no React Native, no network) so `npm test` can run it. Same rules as the website's createRecurring.
import { addDays, isDate, isSaneDate, manilaToday, parseAmountMinor } from '../../src/core/money.ts';

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const MAX_RULES = 100;
export const MAX_DESCRIPTION = 120;

export type RuleForm = {
  id: string; // made once per form, so a double-tap or retry saves once (primary key)
  type: 'income' | 'expense';
  amount: string;
  description: string;
  accountId: string;
  categoryId: string;
  frequency: Frequency;
  interval: string;
  start: string;
};

export type RuleRow = {
  id: string;
  account_id: string;
  category_id: string;
  type: 'income' | 'expense';
  amount_minor: number;
  description: string;
  frequency: Frequency;
  interval_count: number;
  start_date: string;
  next_run_date: string; // a new rule first runs on its start date
  end_date: string | null;
  active: boolean;
};

type Ctx = { accounts: { id: string }[]; categories: { id: string; type: 'income' | 'expense' }[] };

export function validateRule(f: RuleForm, ctx: Ctx, today = manilaToday()): { ok: true; row: RuleRow } | { ok: false; message: string } {
  const bad = (message: string) => ({ ok: false as const, message });
  const amount = parseAmountMinor(f.amount.trim());
  if (amount === null)
    return bad(
      f.amount.trim() === ''
        ? 'Type the amount, like 15000 or 499.50.'
        : `"${f.amount.trim().slice(0, 20)}" is not a valid amount. Use a number above 0 like 1500 or 1500.50, up to 999,999,999.99.`,
    );
  if (f.type !== 'income' && f.type !== 'expense') return bad('Pick whether this is money in or money out.');
  const cat = ctx.categories.find((x) => x.id === f.categoryId);
  if (!cat) return bad('Pick a category.');
  if (cat.type !== f.type) return bad(`Pick a ${f.type} category. The one chosen is for ${cat.type}.`);
  if (!ctx.accounts.some((a) => a.id === f.accountId)) return bad('Pick an account.');
  if (!FREQUENCIES.includes(f.frequency)) return bad('Pick how often it repeats.');
  const raw = f.interval.trim() === '' ? '1' : f.interval.trim();
  const n = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 365) return bad('Repeat every must be a whole number from 1 to 365.');
  const start = f.start.trim();
  if (!isDate(start) || !isSaneDate(start, today)) return bad('Type the start date as YYYY-MM-DD, like 2026-11-01.');
  if (start < addDays(today, -730) || start > addDays(today, 730)) return bad('Start date must be within 2 years of today.');
  const description = f.description.trim();
  if (description.length > MAX_DESCRIPTION) return bad(`Keep the description to ${MAX_DESCRIPTION} characters or fewer.`);
  return {
    ok: true,
    row: {
      id: f.id,
      account_id: f.accountId,
      category_id: f.categoryId,
      type: f.type,
      amount_minor: amount,
      description,
      frequency: f.frequency,
      interval_count: n,
      start_date: start,
      next_run_date: start,
      end_date: null,
      active: true,
    },
  };
}

const UNIT: Record<string, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

// "Every month from 2026-10-01", "Every 2 weeks from 2026-10-01 until 2027-03-01"
export function describeRule(r: { frequency: string; interval_count: number; start_date: string; end_date: string | null }): string {
  const unit = UNIT[r.frequency] ?? 'period';
  const every = r.interval_count === 1 ? `Every ${unit}` : `Every ${r.interval_count} ${unit}s`;
  return `${every} from ${r.start_date}${r.end_date ? ` until ${r.end_date}` : ''}`;
}

// What to tell the person when a write fails. Never the raw database text.
export function recurringError(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  if (error.code === 'PRLIM' || /PRLIM/.test(error.message))
    return `You can have at most ${MAX_RULES} recurring rules. Delete one to add another.`;
  return 'Not saved: the server refused it or could not be reached. Try again.';
}

// ---- Schedule maths. Mirrors recurring_occurrence(r, k) in supabase/migrations/0002_app.sql exactly. ----
export type Schedule = { start_date: string; frequency: string; interval_count: number };

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

// Postgres `date + make_interval(months => n)`: same day of month, clamped to the last valid day of the target month.
function addMonths(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m0 = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  const total = y * 12 + m0 + n;
  const ty = Math.floor(total / 12);
  const tm0 = total - ty * 12;
  return `${pad(ty, 4)}-${pad(tm0 + 1)}-${pad(Math.min(d, daysInMonth(ty, tm0)))}`;
}

// The date of the k-th run (k starts at 0), always computed from start_date so it never drifts.
export function occurrence(rule: Schedule, k: number): string {
  const n = k * rule.interval_count;
  switch (rule.frequency) {
    case 'daily':
      return addDays(rule.start_date, n);
    case 'weekly':
      return addDays(rule.start_date, 7 * n);
    case 'monthly':
      return addMonths(rule.start_date, n);
    default:
      return addMonths(rule.start_date, 12 * n); // yearly
  }
}

// Resuming a paused rule: skip every date missed while it was paused. The first run is the first occurrence on or after today.
export function resumePlan(
  rule: Schedule & { end_date: string | null },
  today: string,
): { run_count: number; next_run_date: string; active: boolean } {
  let k = 0;
  let d = occurrence(rule, 0);
  while (d < today) {
    k++;
    d = occurrence(rule, k);
    if (k > 100_000) break; // a daily rule needs well under this; never loop forever on bad data
  }
  return { run_count: k, next_run_date: d, active: rule.end_date === null || d <= rule.end_date };
}

// ---- Clock safety ----
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'Tue, 14 Oct 2026 02:10:00 GMT' (an HTTP Date header) -> '2026-10-14' on the Asia/Manila calendar. null if it cannot be read.
export function manilaDateFromHttpDate(header: string): string | null {
  if (typeof header !== 'string') return null;
  const m = /^[A-Za-z]{3}, (\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(header.trim());
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2]);
  const [day, year, hh, mm, ss] = [m[1], m[3], m[4], m[5], m[6]].map(Number);
  if (mon < 0 || day < 1 || day > daysInMonth(year, mon) || hh > 23 || mm > 59 || ss > 59) return null;
  return manilaToday(new Date(Date.UTC(year, mon, day, hh, mm, ss)));
}

// Run the due rules when we never have, or when the Manila day has changed since the last run.
export function shouldRunDue(lastRunDate: string | null, today: string): boolean {
  return lastRunDate === null || lastRunDate !== today;
}
