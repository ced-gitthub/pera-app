// Pure logic (no React Native, no network) so the website's `npm test` can run it.
import { parseInput, FEE_CATS, type Item, type Parsed } from '../../src/core/parser.ts';
import { manilaToday, parseAmountMinor, isSaneDate } from '../../src/core/money.ts';
import { parseOptionalMinor } from '../../src/lib/validate.ts';
import { budgetStatus } from '../../src/core/aggregate.ts';
import { streak } from '../../src/lib/vibe.ts';
import { xpFor, levelInfo, buildQuests } from '../../src/lib/quests.ts';
import { openingFromToday, gateFor, type Gate } from '../../src/lib/onboarding.ts';

export type Account = {
  id: string;
  name: string;
  short_name: string | null;
  counts_as_savings: boolean;
  opening_balance_minor: number;
  show_on_home: boolean;
};
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
export type Snapshot = {
  accounts: Account[];
  categories: Category[];
  balances: Record<string, number>;
  recent: Tx[];
  dates: string[]; // dates of the last 60 days of entries, one per entry, for the streak
  totalEntries: number;
  noAccount: number; // balance of entries with no account (legacy), counted in Total like the website
  sampleMovement?: Record<string, number>; // what the tour's "Sample:" entries add to each account (they are not money the person logged)
};

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

// The balance the setup form starts from: what the account shows, WITHOUT the sample entries (deleting them later must not change what the person typed).
export const balancePrefill = (s: Snapshot, a: Account): number =>
  (s.balances[a.id] ?? a.opening_balance_minor) - (s.sampleMovement?.[a.id] ?? 0);

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
    const o = openingFromToday(v, balancePrefill(s, a), a.opening_balance_minor);
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
  const st = budgetStatus(limit, spent); // the website's own rule (rounded tenths of a percent), so both apps agree
  const over = st.state === 'over';
  return {
    over,
    left: over ? 0 : limit - spent,
    overBy: over ? spent - limit : 0,
    pct: Math.min(100, Math.floor(st.usageTenths / 10)),
    state: st.state,
  };
}

// Savings goal not tied to an account: income minus expenses over the period, from the period_summary rows.
export function netFromSummary(rows: { type: string; total_minor: number | string }[]) {
  return rows.reduce((n, x) => n + (x.type === 'income' ? Number(x.total_minor) : x.type === 'expense' ? -Number(x.total_minor) : 0), 0);
}

// What to tell the person when the code could not be sent. Sign-in hides server replies (no account enumeration); sign-up has nothing to hide.
export function sendCodeError(error: { message: string; status?: number } | null, creating: boolean): string | null {
  if (!error) return null;
  if (/rate/i.test(error.message)) return 'Too many tries. Wait a minute and ask for a new code.';
  if (!error.status || error.status >= 500) return 'Could not reach the server. Check your connection.';
  return creating ? 'Sign-up is not available for that email right now. Check the address, or try again later.' : null;
}

// ---- Home numbers. Spendable = every non-savings account (a card or overdraft below zero REDUCES it), Savings = the savings accounts,
// and Spendable + Savings is always the Total, so the numbers can never disagree. "owed" is information only: how much of it is debt.
export function homeView(s: Snapshot) {
  let spendable = s.noAccount, // older entries with no account count as spendable money
    savings = 0,
    owed = s.noAccount < 0 ? -s.noAccount : 0;
  for (const a of s.accounts) {
    const b = s.balances[a.id] ?? 0;
    if (a.counts_as_savings) savings += b;
    else spendable += b;
    if (b < 0) owed -= b;
  }
  return {
    spendable,
    savings,
    owed,
    total: spendable + savings,
    hero: s.accounts.some((a) => a.counts_as_savings) ? ('spendable' as const) : ('total' as const),
    cards: s.accounts.filter((a) => a.show_on_home),
  };
}

export type HomeTile = { kind: 'spendable' | 'savings'; amount: number } | { kind: 'account'; id: string; name: string; amount: number };
// Four tiles fit on Home without scrolling: Spendable, Savings, then the first two other accounts shown on Home.
export function homeTiles(s: Snapshot): HomeTile[] {
  const v = homeView(s);
  const others = v.cards.filter((a) => !a.counts_as_savings).slice(0, 2);
  return [
    { kind: 'spendable', amount: v.spendable },
    { kind: 'savings', amount: v.savings },
    ...others.map((a) => ({ kind: 'account' as const, id: a.id, name: a.name, amount: s.balances[a.id] ?? 0 })),
  ];
}

export type OverviewRow = { id: string; name: string; balance: number; group: 'spendable' | 'savings'; showOnHome: boolean };
// Every account (hidden ones too) in the same two groups as the Home numbers, so each group's rows add up to its figure.
export function accountsOverview(s: Snapshot) {
  const rows: OverviewRow[] = s.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    balance: s.balances[a.id] ?? 0,
    group: a.counts_as_savings ? 'savings' : 'spendable',
    showOnHome: a.show_on_home,
  }));
  // older entries with no account have no row of their own, so they get one
  if (s.noAccount !== 0)
    rows.push({ id: 'none', name: 'No account (older entries)', balance: s.noAccount, group: 'spendable', showOnHome: false });
  const v = homeView(s);
  return { rows, spendable: v.spendable, savings: v.savings, owed: v.owed, total: v.total };
}

// ---- the game strip: streak, XP and level, all derived from entries (website rules)
export function gameView(dates: string[], totalEntries: number, today: string) {
  const st = streak(dates, today);
  const xp = xpFor({ totalEntries, streak: st.n });
  const quest = buildQuests({ today, dates, budgets: [], totalEntries, streak: st.n }).find((q) => !q.done) ?? null;
  return { streak: st.n, loggedToday: st.loggedToday, week: st.week, xp, level: levelInfo(xp), quest };
}

export type ActivityFilter = { type: 'all' | 'income' | 'expense' | 'transfer'; accountId: string };
export const filterActivity = (rows: Tx[], f: ActivityFilter) =>
  rows.filter((r) => (f.type === 'all' || r.type === f.type) && (!f.accountId || r.account_id === f.accountId));

// ---- settings: the display name (same limits as the website's profile name)
export function cleanName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, message: 'Type your name so we can greet you.' };
  if (name.length > 40) return { ok: false, message: 'Keep your name to 40 characters or fewer.' };
  return { ok: true, name };
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? '';

// What to tell the person when a create/update fails: a full list, a duplicate name, or a generic retry. Never the raw database text.
const CAPS: Record<string, string> = {
  goal: 'You can have at most 12 goals. Delete one to add another.',
  budget: 'You have reached the limit of budgets. Delete one to add another.',
};
export function writeError(error: { message: string; code?: string } | null, what: 'goal' | 'budget', name = ''): string | null {
  if (!error) return null;
  if (error.code === 'PRLIM' || /PRLIM/.test(error.message)) return CAPS[what];
  if (error.code === '23505') return `You already have a ${what} called "${name}". Pick another name.`;
  return 'Not saved: the server refused it or could not be reached. Try again.';
}

// ---- editing and undoing a logged entry (same rules as the website's updateTx / restoreRow)
export type TxEdit = {
  type: 'income' | 'expense' | 'transfer';
  amount: string;
  date: string;
  description: string;
  accountId: string;
  toId: string;
  categoryId: string;
};
export type TxPatch = {
  amount_minor: number;
  transaction_date: string;
  description: string;
  account_id: string;
  type: TxEdit['type'];
  category_id: string | null;
  transfer_account_id: string | null;
};
export function planTxEdit(i: TxEdit, s: Snapshot, today = manilaToday()): { ok: true; patch: TxPatch } | { ok: false; message: string } {
  const amt = parseAmountMinor(i.amount.trim());
  if (amt === null) return { ok: false, message: 'Amount must be 0.01 to 999,999,999.99, with at most 2 decimals.' };
  if (!isSaneDate(i.date.trim(), today))
    return { ok: false, message: 'Use a real date like 2026-10-14 (between the year 2000 and five years from now).' };
  if (!s.accounts.some((a) => a.id === i.accountId)) return { ok: false, message: 'Pick one of your accounts.' };
  const base = {
    amount_minor: amt,
    transaction_date: i.date.trim(),
    description: i.description.slice(0, 120),
    account_id: i.accountId,
    type: i.type,
  };
  if (i.type === 'transfer') {
    if (!s.accounts.some((a) => a.id === i.toId)) return { ok: false, message: 'Pick the account the money goes to.' };
    if (i.toId === i.accountId) return { ok: false, message: 'Choose two different accounts.' };
    return { ok: true, patch: { ...base, category_id: null, transfer_account_id: i.toId } };
  }
  const cat = s.categories.find((x) => x.id === i.categoryId);
  if (!cat || cat.type !== i.type) return { ok: false, message: 'Pick a category that matches the type.' };
  return { ok: true, patch: { ...base, category_id: cat.id, transfer_account_id: null } };
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
// The row to put back after a delete: only known columns, no nulls, always owned by the signed-in user.
export function restoreRowOf(row: Record<string, unknown>, userId: string): Record<string, unknown> {
  const r: Record<string, unknown> = { user_id: userId };
  for (const k of RESTORE) if (row[k] !== undefined && row[k] !== null) r[k] = row[k];
  return r;
}
