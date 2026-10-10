import { parseAmountMinor, isDate, addDays, dayOfWeek } from './money.ts';
export const INC = ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other Income'];
export const EXP = ['Food', 'Groceries', 'Transportation', 'Bills', 'Utilities', 'Rent', 'Shopping', 'Entertainment', 'Health', 'Education', 'Subscriptions', 'Travel', 'Personal', 'Other'];
const LK: Record<string, { c: string; type: 'income' | 'expense' }> = {};
const reg = (type: 'income' | 'expense', m: Record<string, string>) => { for (const c in m) for (const w of m[c].split(' ')) LK[w] ??= { c, type }; };
reg('income', { Salary: 'salary wage payroll', Freelance: 'freelance', Business: 'business sales', Investment: 'investment dividend interest', Gift: 'gift', 'Other Income': 'income bonus refund' });
reg('expense', { Food: 'food lunch dinner breakfast meal restaurant mcdonalds jollibee snack coffee starbucks drink drinks beverage juice tea milktea soda beer pizza burger rice merienda', Groceries: 'grocery groceries supermarket', Transportation: 'transport transportation grab taxi bus fare jeepney mrt fuel gas commute', Bills: 'bill bills internet phone load wifi', Utilities: 'electricity water utilities power', Rent: 'rent', Shopping: 'shopping amazon lazada shopee clothes', Entertainment: 'entertainment movie movies game games cinema', Health: 'health medicine doctor pharmacy', Education: 'education tuition school books', Subscriptions: 'subscription subscriptions netflix spotify', Travel: 'travel flight hotel', Personal: 'personal haircut salon', Other: 'other misc' });
export const categoryFor = (s: string) => { for (const w of s.toLowerCase().split(/[^a-z0-9']+/)) { const h = LK[w.replace(/'/g, '')]; if (h) return h; } };

export const FEE_CATS = ['Transfer Fee', 'ATM Fee', 'Cash-in Fee', 'Cash-out Fee', 'Annual Fee', 'Late Fee', 'Service Fee', 'Maintenance Fee', 'Overdraft Fee', 'Foreign Exchange Fee'];
// First match wins. "Transfer Fee" is last-but-one so "late transfer fee" is a Late Fee only when you say "late".
const FEE_RULES: [string, RegExp][] = [['ATM Fee', /\batm\b/], ['Cash-in Fee', /\bcash[- ]?in\b/], ['Cash-out Fee', /\b(?:cash[- ]?out|withdrawals?)\b/], ['Overdraft Fee', /\boverdraft\b/], ['Maintenance Fee', /\bmaintenance\b/],
  ['Foreign Exchange Fee', /\b(?:foreign|forex|currency)\b/], ['Late Fee', /\b(?:late|overdue|penalty)\b/], ['Annual Fee', /\b(?:annual|yearly|membership)\b/], ['Transfer Fee', /\b(?:instapay|pesonet|transfer|bank|remittance)\b/],
  ['Service Fee', /\b(?:service|processing|handling|convenience|platform|booking|delivery)\b/]];
const feeRule = (s: string) => FEE_RULES.find(([, r]) => r.test(s));
// A card account is one whose name says so, or whose short name is "cc". Used for "pay cc ..." and for showing transfers as card payments.
export const isCardName = (name: string, short?: string | null) => /credit|card/i.test(name) || (short ?? '').trim().toLowerCase() === 'cc';
export type Ctx = { today: string; accounts: string[]; aliases?: Record<string, string>; balances?: Record<string, number> }; // aliases: short name -> account name; balances: account name -> current balance (minor)
export type Item = { type: 'income' | 'expense' | 'transfer'; amount_minor: number; category: string; description: string; date: string; account: string; to_account?: string };
export type Parsed = ({ kind: 'ok' | 'confirm' } & Item & { fee?: Item }) | { kind: 'ask'; amount_minor: number; label: string; date: string; account: string; raw: string } | { kind: 'error'; message: string };
const AMB = /\b(amazon|lazada|shopee)\b/, STOP = new Set('i a an the my on for to from of in was is some at with via using into off'.split(' ')), VERB = /^(spent|spend|spending|expense|expenses|paid|pay|payment|bought|buy|earned|earn|received|receive|got|sent|transfer|transferred|move|moved)$/;
const IV = /\b(income|salary|earned|earn|received|receive|got|bonus|refund|sent)\b/, EV = /\b(spent|spend|spending|expense|expenses|paid|pay|bought|buy)\b/;
const title = (s: string) => s.replace(/(^|\s)\w/g, c => c.toUpperCase());
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const splitInput = (t: string) => t.split(/,(?!\d{3}(?!\d))|[;\n]/).slice(0, 50).filter(s => s.trim());
const MON = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' '), MW = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const PREP = 'from|via|using|thru|through|into|in|with|to';
type Hit = { name: string; key: string; alias: boolean; prep: string; start: number; end: number };
// Every account (and short name) mentioned in the text, longest name first so "Maya Credit Card" is never read as "Maya". A preposition before the name is optional.
function findAccounts(t: string, ctx: Ctx): Hit[] {
  const c = ctx.accounts.map(n => ({ name: n, key: n.toLowerCase(), alias: false }));
  for (const [k, n] of Object.entries(ctx.aliases ?? {})) if (ctx.accounts.includes(n) && k.trim()) c.push({ name: n, key: k.toLowerCase(), alias: true });
  c.sort((a, b) => b.key.length - a.key.length);
  let w = /\bfees?\b/.test(t) ? t.replace(/\bcash[- ]?(?:in|out)\b/g, m => ' '.repeat(m.length)) : t; const out: Hit[] = []; // in "cash out fee" the word cash is the fee, not the Cash account
  for (const x of c) {
    const re = new RegExp('(?<![a-z0-9])(?:(' + PREP + ')\\s+)?' + esc(x.key) + '(?![a-z0-9])', 'g'); let m: RegExpExecArray | null;
    while ((m = re.exec(w))) { out.push({ ...x, prep: m[1] ?? '', start: m.index, end: m.index + m[0].length }); w = w.slice(0, m.index) + ' '.repeat(m[0].length) + w.slice(m.index + m[0].length); re.lastIndex = m.index + m[0].length; }
  }
  return out.sort((a, b) => a.start - b.start);
}
const blank = (t: string, ...h: (Hit | undefined)[]) => { for (const x of h) if (x) t = t.slice(0, x.start) + ' '.repeat(x.end - x.start) + t.slice(x.end); return t; };
// "15 fee", "with 15 instapay fee", ". 15 pesonet fee", "fee 15": the fee attached to a transfer. Returns the text without it.
function takeFee(t: string): { t: string; amount?: number; cat?: string; bad?: boolean } {
  const N = '(\\d[\\d,]*(?:\\.\\d+)?)';
  let amt = '', k: string | undefined, q: string | undefined, whole = '';
  let m = t.match(new RegExp('(?:\\b([a-z-]+)\\s+)?\\bfees?\\b\\s*(?:of\\s+|is\\s+|:\\s*)?' + N + '\\s*(k)?\\b')); // "fee 15", "instapay fee 15"
  if (m) { q = m[1]; amt = m[2]; k = m[3]; whole = m[0]; }
  else if ((m = t.match(new RegExp('(?:[.;+]\\s*|\\bwith\\s+|\\band\\s+|\\bplus\\s+)?' + N + '\\s*(k)?\\b\\s*(?:([a-z-]+)\\s+)?fees?\\b')))) { amt = m[1]; k = m[2]; q = m[3]; whole = m[0]; } // "15 fee", "with 15 instapay fee"
  if (!whole) return { t };
  const out = t.replace(whole, q && !feeRule(q) ? ` ${q} ` : ' '), amount = parseAmountMinor(amt, !!k); // a word that is not a fee word (e.g. an account) stays in the text
  return amount === null ? { t: out, bad: true } : { t: out, amount, cat: (q && feeRule(q)?.[0]) || 'Transfer Fee' };
}
export function parseSegment(raw: string, ctx: Ctx, force?: 'income' | 'expense'): Parsed {
  let t = ' ' + raw.toLowerCase().replace(/₱|\bphp\b|\bpesos?\b/g, ' ').replace(/\bgot paid\b/g, 'earned') + ' ', date = ctx.today, m: RegExpMatchArray | null, account = '';
  const Q = ` in "${raw.trim().slice(0, 40)}"`, err = (x: string): Parsed => ({ kind: 'error', message: x + Q }), yr = Number(ctx.today.slice(0, 4));
  if (/\b(every|each|daily|weekly|monthly|yearly)\b/.test(t.replace(/\byearly (?=fees?\b)/g, ' '))) return err('Use a recurring rule for repeating items');
  // Dates: only yesterday/today/tomorrow, "last <weekday>", a full 2026-10-05, or a real month word ("oct 5", "5 october 2026"). Bare numbers (1/2, 10/04, 5000) are never dates.
  if (/\byesterday\b/.test(t)) { date = addDays(date, -1); t = t.replace(/\byesterday\b/, ' '); }
  else if (/\btomorrow\b/.test(t)) { date = addDays(date, 1); t = t.replace(/\btomorrow\b/, ' '); }
  else if (/\btoday\b/.test(t)) t = t.replace(/\btoday\b/, ' ');
  else if ((m = t.match(/\blast (sun|mon|tue|wed|thu|fri|sat)\w*/))) { const w = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1]); let d = addDays(date, -1); while (dayOfWeek(d) !== w) d = addDays(d, -1); date = d; t = t.replace(m[0], ' '); }
  else if ((m = t.match(/\b(\d{4}-\d{2}-\d{2})\b/))) { date = m[1]; t = t.replace(m[0], ' '); }
  else {
    const A = new RegExp('\\b' + MW + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(20\\d\\d)\\b)?'), B = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MW + '\\b\\.?(?:\\s*,?\\s*(20\\d\\d)\\b)?');
    const use = (full: string, mo: string, d: string, y?: string) => { // a far-away "year" (e.g. 2000) is really the amount: leave it in the text
      const near = !!y && Math.abs(Number(y) - yr) <= 1, used = y && !near ? full.slice(0, full.lastIndexOf(y)) : full;
      if (!/\d/.test(t.replace(used, ' '))) return; // "oct 5" / "5 oct" is only a date when an amount is left over ("spent 20 may" is not)
      date = `${near ? y : yr}-${String(MON.indexOf(mo.slice(0, 3)) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`; t = t.replace(used, ' '); };
    const a = t.match(A), b = a ? null : t.match(B);
    if (a) use(a[0], a[1], a[2], a[3]); else if (b) use(b[0], b[2], b[1], b[3]);
  }
  if (!isDate(date)) return err('Invalid date');
  t = t.replace(/(?<![\d.,/])\d{1,4}\/\d{1,4}(?:\/\d{2,4})?(?![\d/])/g, ' '); // 1/2 and 10/04 are ignored, never an amount or a date
  // Accounts, longest name first. A "from X to Y" transfer, a "pay cc ..." card payment, or an ordinary entry.
  const hits = force ? findAccounts(t, ctx).filter(h => h.prep !== 'to' && h.prep !== 'into') : findAccounts(t, ctx);
  let src: Hit | undefined, dest: Hit | undefined, mode: '' | 'transfer' | 'pay' = '';
  const first = hits[0], isCard = (h: Hit) => isCardName(h.name) || (h.alias && h.key === 'cc');
  if (!force && /^\s*(?:transfer(?:red)?|move[d]?)\b(?!\s+fees?\b)/.test(t)) {
    mode = 'transfer'; dest = hits.find(h => h.prep === 'to' || h.prep === 'into'); src = hits.find(h => h.prep === 'from') ?? hits.find(h => h !== dest); dest ??= hits.find(h => h !== src);
    if (!src || !dest) return err('A transfer needs two accounts, like "transfer 300 from maya to gcash"');
  } else if (!force && first && isCard(first) && (first.prep === '' || first.prep === 'to' || first.prep === 'into') && /^(?:pay|paid|payment)(?:\s+(?:my|the|for|to|off|into))*$/.test(t.slice(0, first.start).trim())) {
    const from = hits.find(h => h !== first && h.name !== first.name && h.prep !== 'to' && h.prep !== 'into');
    if (from) { mode = 'pay'; dest = first; src = from; }
    else if (!blank(t, first).replace(/\d[\d,.]*k?/g, ' ').split(/[^a-z0-9'&]+/).some(w => w && !STOP.has(w) && !VERB.test(w))) return err(`Pay ${first.name} from which account? Try "pay ${first.key} 500 from ${ctx.accounts.find(a => a !== first.name)?.toLowerCase() ?? 'cash'}"`); // "paid cc 300 lunch" stays an ordinary expense on that card
  }
  if (!mode) {
    const ok = hits.filter(h => h.prep !== 'to' && h.prep !== 'into'), pick = ok.find(h => h.prep) ?? ok[0];
    if (pick) { account = pick.name; t = blank(t, pick); }
  }
  if (mode) {
    if (src!.name === dest!.name) return err('Choose two different accounts');
    t = blank(t, src, dest); let fee: { amount: number; cat: string } | undefined;
    if (/\bfees?\b/.test(t)) { const f = takeFee(t); if (f.bad) return err('The fee must be more than 0'); if (f.amount) fee = { amount: f.amount, cat: f.cat! }; t = f.t; }
    if (/-\s*\d/.test(t.replace(/\d-\d/g, ' '))) return err('Negative amount');
    let amount: number | null; m = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/);
    if (m) { amount = parseAmountMinor(m[1], !!m[2]); if (amount === null) return err('Amount must be 0.01 to 999,999,999.99 with at most 2 decimals'); t = t.replace(m[0], ' '); if (/(^|\s)\d[\d,.]*(\s|$)/.test(t)) return err('More than one amount; separate items with commas'); }
    else if (mode === 'pay') { const owed = -(ctx.balances?.[dest!.name] ?? 0); if (owed <= 0) return err(`Nothing is owed on ${dest!.name}. Add an amount, like "pay ${dest!.key} 500 from ${src!.name.toLowerCase()}"`); amount = owed; }
    else return err('No amount found');
    const words = [...new Set(t.split(/[^a-z0-9'&]+/).filter(w => w && !STOP.has(w) && !VERB.test(w)))];
    const item: Item = { type: 'transfer', amount_minor: amount, category: '', description: title(words.join(' ')).slice(0, 120), date, account: src!.name, to_account: dest!.name };
    return { kind: 'ok', ...item, fee: fee ? { type: 'expense', amount_minor: fee.amount, category: fee.cat, description: '', date, account: src!.name } : undefined };
  }
  if (/(^|[\s:=])[-−]\s*\d/.test(t)) return err('Negative amount. Use "income" for money coming in');
  if (!(m = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/))) return err('No amount found');
  const amount = parseAmountMinor(m[1], !!m[2]);
  if (amount === null) return err('Amount must be 0.01 to 999,999,999.99 with at most 2 decimals');
  t = t.replace(m[0], ' ');
  if (/(^|\s)\d[\d,.]*(\s|$)/.test(t)) return err('More than one amount; separate items with commas');
  let dsc = '', src2 = '', tgt = '';
  if ((m = t.match(/(?:\bat\b|@)\s*(.+)$/))) { dsc = title(m[1].trim()).slice(0, 120); t = t.replace(m[0], ' '); }
  const tk = (s: string) => s.split(/[^a-z0-9'&-]+/).filter(w => w && !STOP.has(w) && !VERB.test(w));
  if (force !== 'income' && /\bfees?\b/.test(t)) { // standalone fee: "atm fee 18 maya", "late fee 500 cc". Nothing more specific = Service Fee.
    const rule = feeRule(t), category = rule?.[0] ?? 'Service Fee'; let r = t.replace(/\bfees?\b/g, ' '); if (rule) r = r.replace(rule[1], ' ');
    return { kind: 'ok', type: 'expense', amount_minor: amount, category, description: dsc || title([...new Set(tk(r))].join(' ')).slice(0, 120), date, account };
  }
  const iv = IV.test(t) && !/\bsent\b.*\bto\b/.test(t), ev = EV.test(t);
  if ((m = t.match(/\b(?:on|for|to)\s+(.+)$/))) { tgt = m[1]; t = t.replace(m[0], ' '); }
  if ((m = t.match(/\bfrom\s+(.+)$/))) { src2 = m[1]; t = t.replace(m[0], ' '); }
  const words = [...tk(tgt), ...tk(src2), ...tk(t)];
  let hit, hw = '';
  for (const w of words) { const h = LK[w.replace(/'/g, '')]; if (h) { hit = h; hw = w; break; } }
  const type = force ?? (iv && !ev ? 'income' : ev && !iv ? 'expense' : hit ? hit.type : null);
  const left = [...new Set(words.filter(w => w !== hw))];
  if (!type) return { kind: 'ask', amount_minor: amount, label: title(left.join(' ') || raw.trim()).slice(0, 40), date, account, raw };
  const ok = hit?.type === type, category = ok ? hit!.c : type === 'income' ? 'Other Income' : 'Other';
  const description = (dsc || (type === 'income' && left.length && !ok ? 'Money from ' + title(left.join(' ')) : title((ok ? [hw] : []).concat(left).filter(w => w !== category.toLowerCase()).join(' ')))).slice(0, 120);
  return { kind: AMB.test(raw.toLowerCase()) || (type === 'expense' && !ok) ? 'confirm' : 'ok', type, amount_minor: amount, category, description, date, account };
}
// A transfer with a fee becomes two entries: the transfer, and a separate expense from the sending account.
export const parseInput = (text: string, ctx: Ctx): Parsed[] => splitInput(text).flatMap((s): Parsed[] => { const p = parseSegment(s, ctx); if (p.kind === 'ok' && p.fee) { const { fee, ...rest } = p; return [rest as Parsed, { kind: 'ok', ...fee }]; } return [p]; });
