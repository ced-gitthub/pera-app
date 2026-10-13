// Pure logic (no React Native, no network) so the website's `npm test` can run it.
import { parseInput, FEE_CATS, type Item, type Parsed } from '../../src/core/parser.ts';
import { manilaToday } from '../../src/core/money.ts';
import { parseOptionalMinor } from '../../src/lib/validate.ts';
import { openingFromToday, gateFor, type Gate } from '../../src/lib/onboarding.ts';

export type Account = { id: string; name: string; short_name: string | null; counts_as_savings: boolean; opening_balance_minor: number };
export type Category = { id: string; name: string; type: 'income' | 'expense' };
export type Tx = {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount_minor: number;
  description: string;
  transaction_date: string;
  category_id: string | null;
  account_id: string | null;
};
export type Snapshot = { accounts: Account[]; categories: Category[]; balances: Record<string, number>; recent: Tx[] };

// Same parser as the website. Only fully understood entries are saved; anything vague asks for a clearer line.
export type Preview = { items: Item[]; problems: string[] };
export function preview(text: string, s: Snapshot, today = manilaToday()): Preview {
  const aliases = Object.fromEntries(s.accounts.filter((a) => a.short_name).map((a) => [a.short_name!.toLowerCase(), a.name]));
  const balances = Object.fromEntries(s.accounts.map((a) => [a.name, s.balances[a.id] ?? 0]));
  const parsed: Parsed[] = parseInput(text.slice(0, 500), { today, accounts: s.accounts.map((a) => a.name), aliases, balances });
  const items: Item[] = [];
  const problems: string[] = [];
  for (const p of parsed) {
    if (p.kind === 'ok') items.push(p, ...(p.fee ? [p.fee] : []));
    else if (p.kind === 'error') problems.push(p.message);
    else problems.push('Not clear enough. Add a category word, e.g. "shopping 500" or "lunch 150 gcash".');
  }
  return { items, problems };
}

// Fee categories used by these items that the user does not have yet (exact fixed names only).
export function missingFeeCategories(items: Item[], categories: Category[]): string[] {
  const wanted = items
    .filter((i) => i.type === 'expense')
    .map((i) => FEE_CATS.find((f) => f.toLowerCase() === i.category.toLowerCase()))
    .filter((x): x is string => !!x);
  return [...new Set(wanted)].filter((n) => !categories.some((c) => c.type === 'expense' && c.name.toLowerCase() === n.toLowerCase()));
}

export const newRequestId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 3) | 8).toString(16);
  });

// Wizard step 2: "what I have in each account today" -> opening balances to store (typed minus what is already logged). Accounts not on the form are never touched.
export function planBalances(
  typed: Record<string, string>,
  s: Snapshot,
): { ok: true; patch: { id: string; v: number }[] } | { ok: false; message: string } {
  const patch: { id: string; v: number }[] = [];
  let any = false;
  for (const a of s.accounts) {
    if (!(a.id in typed)) continue;
    const v = parseOptionalMinor(typed[a.id]);
    if (v === null)
      return { ok: false, message: `"${typed[a.id].slice(0, 20)}" is not a valid amount for ${a.name}. Use numbers like 1500 or 1500.50.` };
    if (v !== 0) any = true;
    const o = openingFromToday(v, s.balances[a.id] ?? a.opening_balance_minor, a.opening_balance_minor);
    if (o === null) return { ok: false, message: `That amount is too large for ${a.name}.` };
    if (o !== a.opening_balance_minor) patch.push({ id: a.id, v: o });
  }
  if (!any)
    return { ok: false, message: 'Type what you have in at least one account. A rough number is fine, you can change it any time.' };
  return { ok: true, patch };
}

// Wizard step 3: one monthly limit for an expense category, this month (Manila).
export function planBudget(categoryId: string, amount: string, s: Snapshot, today = manilaToday()) {
  const c = s.categories.find((x) => x.id === categoryId && x.type === 'expense');
  if (!c) return { ok: false as const, message: 'Pick a category first.' };
  const amt = parseOptionalMinor(amount);
  if (amt === null || amt <= 0) return { ok: false as const, message: 'Type the monthly limit as a number above 0, like 3000.' };
  const [year, month] = today.slice(0, 7).split('-').map(Number);
  return { ok: true as const, row: { category_id: c.id, amount_minor: amt, month, year } };
}

// ---- first-run gate: pure decision + the flag changes that go with it (flags only remember what was SEEN; progress always comes from data)
export type Flags = { onboarded: boolean; wizard: boolean; balances: boolean; toured: boolean };
export type Counts = { totalEntries: number; budgetsCount: number; goalsCount: number };
export const FINISH_FLAGS: Partial<Flags> = { onboarded: true, toured: true, wizard: false };
export const REPLAY_FLAGS: Partial<Flags> = { onboarded: false, toured: false, wizard: false }; // balances is kept, as on the website
export function decideGate(counts: Counts | null, accounts: Account[], flags: Flags): { gate: Gate; set: Partial<Flags> } {
  if (!counts) return { gate: { show: false, mark: false }, set: {} }; // could not read the counts: fail open
  const gate = gateFor({ ...counts, accounts, streak: 0 }, flags);
  const set: Partial<Flags> = {};
  if (gate.show && gate.step !== 'tour' && gate.step !== 'finish' && !flags.wizard) set.wizard = true;
  if (!gate.show && gate.mark && !flags.onboarded) set.onboarded = true;
  return { gate, set };
}

// ---- budgets: first and last day of the Manila month, and the bar maths (integer centavos; a limit of 0 never divides)
export function monthRange(today: string) {
  const [y, m] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}`, month: m, year: y };
}
export function budgetProgress(limit: number, spent: number) {
  const over = spent > limit;
  return {
    over,
    left: over ? 0 : limit - spent,
    overBy: over ? spent - limit : 0,
    pct: limit <= 0 ? (spent > 0 ? 100 : 0) : Math.min(100, Math.floor((spent * 100) / limit)),
  };
}
