import { MAX_MINOR, isDate } from '../core/money.ts';
import { parseInput, type Ctx, type Parsed, type Item } from '../core/parser.ts';
// Optional. The app works with no provider configured (getProvider() === null).
export interface AIProvider {
  name: string;
  parseTransaction(text: string, ctx: Ctx): Promise<unknown>;
  answerFinancialQuestion(question: string, facts: Record<string, number | string>): Promise<string>;
  classifyTransaction(description: string, categories: string[]): Promise<unknown>;
}
export const getProvider = (_env: Record<string, string | undefined>): AIProvider | null => null; // register a free provider here later
// LLM output is untrusted data: validated here, then handed to the normal RLS-protected write path.
export function validateAction(x: unknown, v: { categories: string[]; accounts: string[]; today: string }): { ok: true; item: Item } | { ok: false; error: string } {
  const o = x as Record<string, unknown>;
  if (!o || typeof o !== 'object' || o.action !== 'create_transaction') return { ok: false, error: 'unsupported action' };
  if (!Number.isSafeInteger(o.amount_minor) || (o.amount_minor as number) < 1 || (o.amount_minor as number) > MAX_MINOR) return { ok: false, error: 'bad amount' };
  if (o.type !== 'income' && o.type !== 'expense') return { ok: false, error: 'bad type' };
  const cat = v.categories.find(c => typeof o.category === 'string' && c.toLowerCase() === o.category.toLowerCase());
  if (!cat) return { ok: false, error: 'unknown category' };
  const date = o.date === undefined ? v.today : o.date;
  if (typeof date !== 'string' || !isDate(date)) return { ok: false, error: 'bad date' };
  const account = o.account === undefined || o.account === '' ? '' : typeof o.account === 'string' ? v.accounts.find(a => a.toLowerCase() === (o.account as string).toLowerCase()) : undefined;
  if (account === undefined) return { ok: false, error: 'unknown account' };
  return { ok: true, item: { type: o.type, amount_minor: o.amount_minor as number, category: cat, description: String(o.description ?? '').slice(0, 120), date, account } };
}
export async function parseWithFallback(text: string, ctx: Ctx, cats: string[], p: AIProvider | null): Promise<Parsed[]> {
  const det = parseInput(text, ctx);
  if (!p || det.every(r => r.kind === 'ok')) return det; // simple inputs never call an AI
  try {
    const r = validateAction(await p.parseTransaction(text, ctx), { categories: cats, accounts: ctx.accounts, today: ctx.today });
    return r.ok ? [{ kind: 'confirm', ...r.item }] : det; // AI results always need user confirmation
  } catch { return det; }
}
