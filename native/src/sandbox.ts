// The pretend wallet on the welcome screen: play with it BEFORE making an account. Pure and in-memory; nothing is saved or sent.
import { parseInput } from '../../src/core/parser.ts';

export const SANDBOX_ACCOUNTS = [
  { name: 'Cash', saving: false },
  { name: 'GCash', saving: false },
  { name: 'Savings', saving: true },
];
export const SANDBOX_GOAL_MINOR = 1000000; // "New phone", ₱10,000
const MAX_ENTRIES = 12;
export type SandboxLine = { text: string; kind: 'expense' | 'income' | 'transfer'; amount_minor: number };
export type Sandbox = { balances: Record<string, number>; log: SandboxLine[] };

export const startSandbox = (): Sandbox => ({ balances: { Cash: 150000, GCash: 320000, Savings: 500000 }, log: [] });
// Same rule as the real app: a negative balance lowers its group, and Spendable + Savings is always the total. "owed" is how much of it is debt.
export const sandboxNumbers = (s: Sandbox) => {
  let spendable = 0,
    savings = 0,
    owed = 0;
  for (const a of SANDBOX_ACCOUNTS) {
    const b = s.balances[a.name];
    if (a.saving) savings += b;
    else spendable += b;
    if (b < 0) owed -= b;
  }
  return { spendable, savings, owed, total: spendable + savings };
};
const HELP = 'Try "lunch 150 gcash" or "transfer 500 from gcash to savings".';
export type SandboxResult = { ok: true; state: Sandbox; line: SandboxLine } | { ok: false; message: string };

export function runSandbox(s: Sandbox, text: string, today: string): SandboxResult {
  const t = text.trim().slice(0, 120);
  if (!t) return { ok: false, message: HELP };
  if (s.log.length >= MAX_ENTRIES) return { ok: false, message: 'That is plenty for a sample. Make a free account to keep going.' };
  const p = parseInput(t, { today, accounts: SANDBOX_ACCOUNTS.map((a) => a.name) })[0];
  if (!p || p.kind === 'error') return { ok: false, message: HELP };
  const item =
    p.kind === 'ask'
      ? { type: 'expense' as const, amount_minor: p.amount_minor, account: p.account, to_account: undefined }
      : { type: p.type, amount_minor: p.amount_minor, account: p.account, to_account: p.to_account };
  const known = (n?: string) => SANDBOX_ACCOUNTS.find((a) => a.name.toLowerCase() === (n ?? '').toLowerCase())?.name;
  const from = known(item.account) ?? 'Cash';
  const balances = { ...s.balances };
  if (item.type === 'transfer') {
    const to = known(item.to_account);
    if (!to || to === from) return { ok: false, message: HELP };
    balances[from] -= item.amount_minor;
    balances[to] += item.amount_minor;
  } else balances[from] += item.type === 'income' ? item.amount_minor : -item.amount_minor;
  const line: SandboxLine = { text: t, kind: item.type, amount_minor: item.amount_minor };
  return { ok: true, state: { balances, log: [line, ...s.log] }, line };
}
// 1 = log an expense, 2 = move money to Savings, 3 = watch the goal fill (all done).
export function sandboxStep(s: Sandbox): 1 | 2 | 3 {
  if (!s.log.some((l) => l.kind === 'expense')) return 1;
  if (!s.log.some((l) => l.kind === 'transfer')) return 2;
  return 3;
}
