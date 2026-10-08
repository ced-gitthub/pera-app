import { parseAmountMinor, isDate, addDays, dayOfWeek } from './money.ts';
export const INC = ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other Income'];
export const EXP = ['Food', 'Groceries', 'Transportation', 'Bills', 'Utilities', 'Rent', 'Shopping', 'Entertainment', 'Health', 'Education', 'Subscriptions', 'Travel', 'Personal', 'Other'];
const LK: Record<string, { c: string; type: 'income' | 'expense' }> = {};
const reg = (type: 'income' | 'expense', m: Record<string, string>) => { for (const c in m) for (const w of m[c].split(' ')) LK[w] ??= { c, type }; };
reg('income', { Salary: 'salary wage payroll', Freelance: 'freelance', Business: 'business sales', Investment: 'investment dividend interest', Gift: 'gift', 'Other Income': 'income bonus refund' });
reg('expense', { Food: 'food lunch dinner breakfast meal restaurant mcdonalds jollibee snack coffee starbucks', Groceries: 'grocery groceries supermarket', Transportation: 'transport transportation grab taxi bus fare jeepney mrt fuel gas commute', Bills: 'bill bills internet phone load wifi', Utilities: 'electricity water utilities power', Rent: 'rent', Shopping: 'shopping amazon lazada shopee clothes', Entertainment: 'entertainment movie movies game games cinema', Health: 'health medicine doctor pharmacy', Education: 'education tuition school books', Subscriptions: 'subscription subscriptions netflix spotify', Travel: 'travel flight hotel', Personal: 'personal haircut salon', Other: 'other misc' });
export const categoryFor = (s: string) => { for (const w of s.toLowerCase().split(/[^a-z0-9']+/)) { const h = LK[w.replace(/'/g, '')]; if (h) return h; } };
export type Ctx = { today: string; accounts: string[] };
export type Item = { type: 'income' | 'expense'; amount_minor: number; category: string; description: string; date: string; account: string };
export type Parsed = ({ kind: 'ok' | 'confirm' } & Item) | { kind: 'ask'; amount_minor: number; label: string; date: string; account: string; raw: string } | { kind: 'error'; message: string };
const AMB = /\b(amazon|lazada|shopee)\b/, STOP = new Set('i a an the my on for to from of in was is some at with via using'.split(' ')), VERB = /^(spent|spend|paid|pay|bought|buy|earned|earn|received|receive|got|sent)$/;
const IV = /\b(income|salary|earned|earn|received|receive|got|bonus|refund|sent)\b/, EV = /\b(spent|spend|paid|pay|bought|buy)\b/;
const title = (s: string) => s.replace(/(^|\s)\w/g, c => c.toUpperCase());
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const splitInput = (t: string) => t.split(/,(?!\d{3}(?!\d))|[;\n]/).slice(0, 50).filter(s => s.trim());
export function parseSegment(raw: string, ctx: Ctx, force?: 'income' | 'expense'): Parsed {
  let t = ' ' + raw.toLowerCase().replace(/₱|\bphp\b|\bpesos?\b/g, ' ').replace(/\bgot paid\b/g, 'earned') + ' ', date = ctx.today, m: RegExpMatchArray | null, account = '';
  const Q = ` in "${raw.trim().slice(0, 40)}"`, err = (x: string): Parsed => ({ kind: 'error', message: x + Q });
  if (/\b(every|each|daily|weekly|monthly|yearly)\b/.test(t)) return err('Use a recurring rule for repeating items');
  if (/\byesterday\b/.test(t)) { date = addDays(date, -1); t = t.replace(/\byesterday\b/, ' '); }
  else if (/\btomorrow\b/.test(t)) { date = addDays(date, 1); t = t.replace(/\btomorrow\b/, ' '); }
  else if (/\btoday\b/.test(t)) t = t.replace(/\btoday\b/, ' ');
  else if ((m = t.match(/\blast (sun|mon|tue|wed|thu|fri|sat)\w*/))) { const w = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1]); let d = addDays(date, -1); while (dayOfWeek(d) !== w) d = addDays(d, -1); date = d; t = t.replace(m[0], ' '); }
  else if ((m = t.match(/\b(\d{4}-\d{2}-\d{2})\b/))) { date = m[1]; t = t.replace(m[0], ' '); }
  if (!isDate(date)) return err('Invalid date');
  for (const a of ctx.accounts) { const r = new RegExp('\\b(?:from|via|using|thru|through|in|with)\\s+' + esc(a.toLowerCase()) + '(?![a-z0-9])'); if (r.test(t)) { account = a; t = t.replace(r, ' '); break; } }
  if (/(^|[\s:=])[-−]\s*\d/.test(t)) return err('Negative amount. Use "income" for money coming in');
  if (!(m = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/))) return err('No amount found');
  const amount = parseAmountMinor(m[1], !!m[2]);
  if (amount === null) return err('Amount must be 0.01 to 999,999,999.99 with at most 2 decimals');
  t = t.replace(m[0], ' ');
  if (/(^|\s)\d[\d,.]*(\s|$)/.test(t)) return err('More than one amount; separate items with commas');
  let dsc = '', src = '', tgt = '';
  if ((m = t.match(/(?:\bat\b|@)\s*(.+)$/))) { dsc = title(m[1].trim()).slice(0, 120); t = t.replace(m[0], ' '); }
  const iv = IV.test(t) && !/\bsent\b.*\bto\b/.test(t), ev = EV.test(t);
  if ((m = t.match(/\b(?:on|for|to)\s+(.+)$/))) { tgt = m[1]; t = t.replace(m[0], ' '); }
  if ((m = t.match(/\bfrom\s+(.+)$/))) { src = m[1]; t = t.replace(m[0], ' '); }
  const tk = (s: string) => s.split(/[^a-z0-9'&]+/).filter(w => w && !STOP.has(w) && !VERB.test(w)), words = [...tk(tgt), ...tk(src), ...tk(t)];
  let hit, hw = '';
  for (const w of words) { const h = LK[w.replace(/'/g, '')]; if (h) { hit = h; hw = w; break; } }
  const type = force ?? (iv && !ev ? 'income' : ev && !iv ? 'expense' : hit ? hit.type : null);
  const left = [...new Set(words.filter(w => w !== hw))];
  if (!type) return { kind: 'ask', amount_minor: amount, label: title(left.join(' ') || raw.trim()).slice(0, 40), date, account, raw };
  const ok = hit?.type === type, category = ok ? hit!.c : type === 'income' ? 'Other Income' : 'Other';
  const description = (dsc || (type === 'income' && left.length && !ok ? 'Money from ' + title(left.join(' ')) : title((ok ? [hw] : []).concat(left).filter(w => w !== category.toLowerCase()).join(' ')))).slice(0, 120);
  return { kind: AMB.test(raw.toLowerCase()) || (type === 'expense' && !ok) ? 'confirm' : 'ok', type, amount_minor: amount, category, description, date, account };
}
export const parseInput = (text: string, ctx: Ctx) => splitInput(text).map(s => parseSegment(s, ctx));
