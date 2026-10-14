// Bulk-delete database logic with an injected db, so it can be tested without react-native or a network. reset.ts wires in the real client.
// Row-level security limits every query to the signed-in person's own rows.
import { RESET_KINDS, partialMessage, resetError, sumCounts, type ResetKind, type ResetStep } from './resetLogic.ts';

type DbError = { message: string; code?: string } | null;
type Res = { count?: number | null; error: DbError };
export interface Db {
  from(table: string): {
    select(columns: string, opts: { count: 'exact'; head: true }): PromiseLike<Res>;
    delete(opts?: { count: 'exact' }): { not(column: string, op: string, value: unknown): PromiseLike<Res> };
    update(values: Record<string, unknown>): { not(column: string, op: string, value: unknown): PromiseLike<Res> };
  };
}

// transactions: deleting copies each row to the hidden 30-day tx_trash (migration 0005). Balances are computed from entries, so they return to the starting balance.
export const RESET_TABLES: Record<ResetKind, string> = {
  entries: 'transactions',
  budgets: 'budgets',
  goals: 'savings_goals',
  recurring: 'recurring_transactions',
};

// How many rows would be deleted; null when it could not be counted.
export async function countRows(db: Db, kind: ResetKind): Promise<number | null> {
  if (!RESET_KINDS.includes(kind)) return null;
  const { count, error } = await db.from(RESET_TABLES[kind]).select('id', { count: 'exact', head: true });
  return error || typeof count !== 'number' ? null : count;
}

export type ResetResult = { error: string | null; deleted: number | null };

// Deletes ALL of the person's rows of that kind in one statement. `deleted` is the number the server says it removed (null if unknown or on error).
export async function resetWith(db: Db, kind: ResetKind): Promise<ResetResult> {
  if (!RESET_KINDS.includes(kind)) return { error: 'That cannot be deleted from here. Nothing was deleted.', deleted: null };
  try {
    const { error, count } = await db.from(RESET_TABLES[kind]).delete({ count: 'exact' }).not('id', 'is', null);
    if (error) return { error: resetError(error), deleted: null };
    return { error: null, deleted: typeof count === 'number' ? count : null };
  } catch (x) {
    return { error: resetError(x), deleted: null };
  }
}

// Recurring rules go FIRST so nothing can re-create entries; then the smaller tables, so a failure on the biggest one (entries) leaves the small ones done.
export const ALL_ORDER: ResetKind[] = ['recurring', 'budgets', 'goals', 'entries'];
export type ResetAllResult = { error: string | null; deleted: number | null; done: ResetStep[] };

// Sets every account's starting balance to 0 (the balance on screen is the starting balance plus entries, so with no entries every account shows 0).
export async function zeroBalancesWith(db: Db): Promise<string | null> {
  try {
    const { error } = await db.from('accounts').update({ opening_balance_minor: 0 }).not('id', 'is', null);
    return error ? resetError(error) : null;
  } catch (x) {
    return resetError(x);
  }
}

// Clears EVERYTHING the app stores about money, one step after the other, and stops at the first failure.
export async function resetAllWith(db: Db): Promise<ResetAllResult> {
  const done: ResetStep[] = [];
  let total = 0;
  let known = true;
  for (const kind of ALL_ORDER) {
    const res = await resetWith(db, kind);
    if (res.error) return { error: partialMessage(done, res.error), deleted: null, done };
    done.push(kind);
    if (res.deleted === null) known = false;
    else total += res.deleted;
  }
  const bal = await zeroBalancesWith(db);
  if (bal) return { error: partialMessage(done, bal), deleted: null, done };
  done.push('balances');
  return { error: null, deleted: known ? total : null, done };
}

// Rows across all the tables; null if any count is unknown.
export async function countAllWith(db: Db): Promise<number | null> {
  const [entries, budgets, goals, recurring] = await Promise.all(RESET_KINDS.map((k) => countRows(db, k)));
  return sumCounts({ entries, budgets, goals, recurring });
}
