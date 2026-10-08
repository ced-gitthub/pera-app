export type TxType = 'income' | 'expense' | 'transfer';
export type Tx = { type: TxType; amount_minor: number; category?: string; account?: string | null; to_account?: string | null; date: string };
const signed = (t: Tx) => (t.type === 'income' ? t.amount_minor : t.type === 'expense' ? -t.amount_minor : 0);
export const inRange = (txs: Tx[], from: string, to: string) => txs.filter(t => t.date >= from && t.date <= to);
export function totals(txs: Tx[]) {
  let income = 0, expense = 0;
  for (const t of txs) { if (t.type === 'income') income += t.amount_minor; else if (t.type === 'expense') expense += t.amount_minor; }
  return { income, expense, net: income - expense };
}
export function byCategory(txs: Tx[]) {
  const o: Record<string, number> = {};
  for (const t of txs) if (t.type === 'expense') o[t.category ?? 'Other'] = (o[t.category ?? 'Other'] ?? 0) + t.amount_minor;
  return Object.entries(o).sort((a, b) => b[1] - a[1]);
}
export function accountBalance(opening: number, txs: Tx[], acct: string) {
  let b = opening;
  for (const t of txs) {
    if (t.account === acct) b += t.type === 'transfer' ? -t.amount_minor : signed(t);
    if (t.type === 'transfer' && t.to_account === acct) b += t.amount_minor;
  }
  return b;
}
export const totalBalance = (openings: number[], txs: Tx[]) => openings.reduce((a, b) => a + b, 0) + txs.reduce((s, t) => s + signed(t), 0);
export function budgetStatus(budget: number, spent: number) {
  const usageTenths = budget > 0 ? Math.round((spent * 1000) / budget) : 0; // 625 = 62.5%
  return { remaining: budget - spent, usageTenths, state: usageTenths > 1000 ? 'over' : usageTenths >= 800 ? 'near' : 'ok' };
}
export const pctLabel = (t: number) => (t % 10 === 0 ? `${t / 10}%` : `${Math.trunc(t / 10)}.${t % 10}%`);
