// Home numbers. Integer centavos only. Nothing here depends on the layout or on "Show on Home":
// total = every account balance + entries with no account; savings = balances of accounts flagged "Counts as savings"; spendable = total - savings.
export type Acct = { id: string; counts_as_savings?: boolean };
export function homeNumbers(accounts: Acct[], balance: (id: string) => number, noAccount: number) {
  let total = noAccount, savings = 0;
  for (const a of accounts) { const b = balance(a.id); total += b; if (a.counts_as_savings) savings += b; }
  return { total, savings, spendable: total - savings };
}
