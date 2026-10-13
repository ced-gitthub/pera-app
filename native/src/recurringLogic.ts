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
