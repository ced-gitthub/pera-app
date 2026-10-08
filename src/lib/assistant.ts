import { categoryFor } from '../core/parser.ts';
import { periodFor } from './range.ts';
import type { Cat, Acct } from './validate.ts';
export type Q = { kind: 'spend' | 'income' | 'save' | 'top' | 'compare' | 'biggest' | 'unknown'; from: string; to: string; label: string; categoryId?: string; categoryName?: string; accountId?: string; accountName?: string };
// Pure intent detection. The question text can only select one of these read-only queries; it never becomes SQL or a command.
export function parseQuestion(q: string, v: { categories: Cat[]; accounts: Acct[]; today: string }): Q {
  const s = q.toLowerCase(), key = /last year/.test(s) ? 'prevyear' : /this year|year to date|ytd/.test(s) ? 'year' : /last month|previous month/.test(s) ? 'prev' : 'month';
  const P = periodFor(key, v.today);
  const has = (n: string) => new RegExp('(^|[^a-z0-9])' + n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(s), longest = <T extends { name: string }>(l: T[]) => [...l].sort((x, y) => y.name.length - x.name.length).find(x => has(x.name)); // whole words, longest first: "Cash" must not match inside "GCash"
  let cat = longest(v.categories.filter(c => c.type === 'expense'));
  if (!cat) { const h = categoryFor(s); if (h?.type === 'expense') cat = v.categories.find(c => c.type === 'expense' && c.name === h.c); }
  const acct = longest(v.accounts);
  const kind = /compar|\bvs\b|versus/.test(s) ? 'compare' : /biggest|largest|highest/.test(s) ? 'biggest' : /\bmost\b|top categor/.test(s) ? 'top' : /\bsav/.test(s) ? 'save' : /earn|income|receiv/.test(s) ? 'income' : /spen|spent|cost|pay|expens/.test(s) ? 'spend' : 'unknown';
  return { kind, from: P.from, to: P.to, label: P.label.toLowerCase(), categoryId: cat?.id, categoryName: cat?.name, accountId: acct?.id, accountName: acct?.name };
}
