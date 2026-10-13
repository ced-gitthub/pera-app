// Bulk-delete database logic with an injected db, so it can be tested without react-native or a network. reset.ts wires in the real client.
// Row-level security limits every query to the signed-in person's own rows.
import { RESET_KINDS, resetError, type ResetKind } from './resetLogic.ts';

type DbError = { message: string; code?: string } | null;
type Res = { count?: number | null; error: DbError };
export interface Db {
  from(table: string): {
    select(columns: string, opts: { count: 'exact'; head: true }): PromiseLike<Res>;
    delete(): { not(column: string, op: string, value: unknown): PromiseLike<Res> };
  };
}

// transactions: deleting copies each row to the hidden 30-day tx_trash (migration 0005). Balances are computed from entries, so they return to the starting balance.
export const RESET_TABLES: Record<ResetKind, string> = { entries: 'transactions', budgets: 'budgets', goals: 'savings_goals' };

// How many rows would be deleted; null when it could not be counted.
export async function countRows(db: Db, kind: ResetKind): Promise<number | null> {
  if (!RESET_KINDS.includes(kind)) return null;
  const { count, error } = await db.from(RESET_TABLES[kind]).select('id', { count: 'exact', head: true });
  return error || typeof count !== 'number' ? null : count;
}

// Deletes ALL of the person's rows of that kind. Returns null on success, or a friendly message.
export async function resetWith(db: Db, kind: ResetKind): Promise<string | null> {
  if (!RESET_KINDS.includes(kind)) return 'That cannot be deleted from here. Nothing was deleted.';
  try {
    const { error } = await db.from(RESET_TABLES[kind]).delete().not('id', 'is', null);
    return error ? resetError(error) : null;
  } catch (x) {
    return resetError(x);
  }
}
