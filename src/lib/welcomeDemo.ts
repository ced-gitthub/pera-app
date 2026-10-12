import { parseInput, type Item } from '../core/parser.ts';
import { emojiFor } from './vibe.ts';
// The sample on the welcome screen: a pretend wallet the visitor can play with BEFORE making an account. Pure and in-memory: nothing is saved or sent anywhere.
export const DEMO_GOAL = 3; // entries needed to "finish" the sample
const MAX_ENTRIES = 25;
export const DEMO_ACCOUNTS = ['Cash', 'GCash', 'BPI'];
export type DemoEntry = {
  id: number;
  type: Item['type'];
  amount_minor: number;
  category: string;
  description: string;
  account: string;
  to?: string;
  emoji: string;
};
export type DemoState = { balances: Record<string, number>; entries: DemoEntry[]; nextId: number };
export const startDemo = (): DemoState => ({ balances: { Cash: 250000, GCash: 120000, BPI: 800000 }, entries: [], nextId: 1 });
export type AddResult = { ok: true; state: DemoState; entry: DemoEntry } | { ok: false; message: string };
const HELP = 'Try something like "lunch 150 gcash" or "salary 5000 bpi".';
export function addEntry(state: DemoState, text: string, today: string): AddResult {
  const t = text.trim().slice(0, 120);
  if (!t) return { ok: false, message: HELP };
  if (state.entries.length >= MAX_ENTRIES) return { ok: false, message: 'That is plenty for a sample. Make a free account to keep going.' };
  const parsed = parseInput(t, { today, accounts: DEMO_ACCOUNTS })[0];
  if (!parsed) return { ok: false, message: HELP };
  if (parsed.kind === 'error') return { ok: false, message: parsed.message || HELP };
  // "ask" means the words were not recognised as a category: in the sample we simply file it under Other as an expense.
  const item: Item =
    parsed.kind === 'ask'
      ? {
          type: 'expense',
          amount_minor: parsed.amount_minor,
          category: 'Other',
          description: parsed.label,
          date: parsed.date,
          account: parsed.account,
        }
      : parsed;
  const account = DEMO_ACCOUNTS.includes(item.account) ? item.account : 'Cash';
  const balances = { ...state.balances };
  if (item.type === 'expense') balances[account] -= item.amount_minor;
  else if (item.type === 'income') balances[account] += item.amount_minor;
  else if (item.to_account && DEMO_ACCOUNTS.includes(item.to_account)) {
    balances[account] -= item.amount_minor;
    balances[item.to_account] += item.amount_minor;
  }
  const entry: DemoEntry = {
    id: state.nextId,
    type: item.type,
    amount_minor: item.amount_minor,
    category: item.category,
    description: item.description || item.category,
    account,
    to: item.to_account,
    emoji: item.type === 'transfer' ? '🔁' : emojiFor(item.category, item.type),
  };
  return { ok: true, entry, state: { balances, entries: [entry, ...state.entries], nextId: state.nextId + 1 } };
}
export function levelFor(entries: number) {
  const done = entries >= DEMO_GOAL;
  return {
    step: Math.min(entries, DEMO_GOAL),
    done,
    title: done ? 'Zovix tracker' : entries === 0 ? 'Getting started' : entries === 1 ? 'First peso tracked' : 'On a roll',
    next: done
      ? 'You did it. Your streak is waiting.'
      : entries === 0
        ? 'Add your first entry'
        : `${DEMO_GOAL - entries} more to unlock your badge`,
  };
}
export const loginCaption = (returning: boolean) =>
  returning ? 'Welcome back · pick up where you left off' : 'Start free · see where every peso goes';
export const total = (s: DemoState) => Object.values(s.balances).reduce((a, b) => a + b, 0);
// Spending by category for the little chart (largest first).
export function spendByCategory(s: DemoState) {
  const m: Record<string, number> = {};
  for (const e of s.entries) if (e.type === 'expense') m[e.category] = (m[e.category] ?? 0) + e.amount_minor;
  return Object.entries(m)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
