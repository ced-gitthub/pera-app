// Pure logic (no React Native, no network) so the website's `npm test` can run it.
import { parseInput, FEE_CATS, type Item, type Parsed } from '../../src/core/parser.ts';
import { manilaToday } from '../../src/core/money.ts';

export type Account = { id: string; name: string; short_name: string | null; counts_as_savings: boolean };
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
