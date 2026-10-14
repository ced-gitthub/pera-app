// Sample entries for the tour (pure: no React Native, no network). They are ordinary entries with fixed request ids (SAMPLE_IDS),
// so removing them can target exactly those rows and can never touch an entry the person made (their request ids are random).
import { addDays } from '../../src/core/money.ts';
import type { Account, Category, TxPatch } from './logic.ts';

// transactions.request_id is a uuid column, so these are fixed, valid uuids (v4 shape). Real request ids are random, so they never collide.
export const SAMPLE_IDS = [1, 2, 3, 4, 5, 6].map((n) => `5a3e0000-0000-4000-8000-00000000000${n}`);

export const SAMPLE_LABEL = 'Sample:';
type Seed = { n: number; type: 'income' | 'expense'; amount: number; ago: number; text: string; cat: RegExp };
const SEEDS: Seed[] = [
  { n: 1, type: 'income', amount: 2_500_000, ago: 6, text: 'Sample: Salary', cat: /salary|income|allowance/i },
  { n: 2, type: 'expense', amount: 125_000, ago: 4, text: 'Sample: Groceries', cat: /food|grocer/i },
  { n: 3, type: 'expense', amount: 35_000, ago: 3, text: 'Sample: Coffee with friends', cat: /food|coffee|eat/i },
  { n: 4, type: 'expense', amount: 5_000, ago: 2, text: 'Sample: Jeepney fare', cat: /transport|fare|commute/i },
  { n: 5, type: 'expense', amount: 49_900, ago: 1, text: 'Sample: Mobile load', cat: /bill|load|utilit|phone/i },
  { n: 6, type: 'expense', amount: 18_000, ago: 0, text: 'Sample: Lunch', cat: /food|lunch|eat/i },
];

export type SampleRow = { requestId: string; patch: TxPatch };

// Uses the person's own first spending account (not a savings one when possible) and their own categories; a missing category is left empty.
export function buildSampleRows(accounts: Account[], categories: Category[], today: string): SampleRow[] {
  const acc = accounts.find((a) => !a.counts_as_savings) ?? accounts[0];
  if (!acc) return [];
  return SEEDS.map((x) => {
    const pool = categories.filter((c) => c.type === x.type);
    const cat = pool.find((c) => x.cat.test(c.name)) ?? pool[0] ?? null;
    return {
      requestId: SAMPLE_IDS[x.n - 1],
      patch: {
        amount_minor: x.amount,
        transaction_date: addDays(today, -x.ago),
        description: x.text,
        account_id: acc.id,
        type: x.type,
        category_id: cat ? cat.id : null,
        transfer_account_id: null,
      },
    };
  });
}

// Offered only when the account has nothing yet, so sample entries never mix with real ones. Unknown counts: never offered.
export function canOfferSample(
  counts: { totalEntries: number; budgetsCount: number; goalsCount: number } | null,
  accountCount: number,
): boolean {
  return !!counts && counts.totalEntries === 0 && accountCount > 0;
}

export const SAMPLE_FAIL = 'Could not add the sample entries. Nothing else was changed. You can still take the tour without them.';
export const SAMPLE_REMOVE_FAIL = 'Could not clear the sample entries. They are still there. Try again.';

// The question after the tour. "Clear" means ALL of it (sample entries, the budget and goal made during setup, starting balances, recurring rules),
// because that is what a person means by "clear all data"; the words below must stay true to the code (tests/native-sample.test.ts checks them).
export const TOUR_END_TITLE = 'Keep what you set up?';
export const TOUR_END_TEXT =
  'The tour added sample entries, and the setup steps made your budget, goal and starting balances. Sample entries count in your balances until you clear them. Keep everything, or clear everything (sample entries, budgets, goals, recurring rules and starting balances) and use an empty app. Your login, accounts and categories stay.';
export const TOUR_END_KEEP = 'Keep everything';
export const TOUR_END_CLEAR = 'Clear everything';
export const TOUR_END_CONFIRM = 'Yes, delete everything';

/** The movement the sample entries put on each account (income +, expense -). Setup balances must not count it as money the person logged. */
export function sampleMovementOf(rows: { account_id: string | null; type: string; amount_minor: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (!r.account_id || (r.type !== 'income' && r.type !== 'expense')) continue;
    out[r.account_id] = (out[r.account_id] ?? 0) + (r.type === 'income' ? r.amount_minor : -r.amount_minor);
  }
  return out;
}

// Shown on the setup balances step while the tour's sample entries exist (they change what an account shows).
export const BALANCE_SAMPLE_NOTE = 'The sample entries are added on top of this until you clear them.';
