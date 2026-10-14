// Sample entries for the tour (pure: no React Native, no network). They are ordinary entries with fixed request ids "zv-sample-N",
// so removing them can target exactly those rows and can never touch an entry the person made (their request ids are random).
import { addDays } from '../../src/core/money.ts';
import type { Account, Category, TxPatch } from './logic.ts';

export const SAMPLE_IDS = [1, 2, 3, 4, 5, 6].map((n) => `zv-sample-${n}`);

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
      requestId: `zv-sample-${x.n}`,
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
export function canOfferSample(counts: { totalEntries: number; budgetsCount: number; goalsCount: number } | null, accountCount: number): boolean {
  return !!counts && counts.totalEntries === 0 && accountCount > 0;
}

export const SAMPLE_FAIL = 'Could not add the sample entries. Nothing else was changed. You can still take the tour without them.';
export const SAMPLE_REMOVE_FAIL = 'Could not clear the sample entries. They are still there. Try again.';
