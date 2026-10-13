// Clears everything a brand-new account might start with, with an injected db so it can be tested. fresh.ts wires in the real client.
// Row-level security limits every statement to the signed-in person's own rows.
import { resetWith, type Db } from './resetCore.ts';
import type { ResetKind } from './resetLogic.ts';

type DbErr = { message: string; code?: string } | null;
export interface FreshDb extends Db {
  from(table: string): ReturnType<Db['from']> & {
    update(values: { opening_balance_minor: number }): { neq(column: string, value: number): PromiseLike<{ error: DbErr }> };
  };
}

const KINDS: ResetKind[] = ['entries', 'budgets', 'goals'];
const FAILED = 'Could not prepare your new account. Pull down to try again.';

// Deletes all entries, budgets and goals, then puts every account's starting balance back to zero. Stops at the first failure.
export async function cleanNewAccountWith(db: FreshDb): Promise<string | null> {
  for (const kind of KINDS) {
    const r = await resetWith(db, kind);
    if (r.error) return FAILED;
  }
  try {
    const { error } = await db.from('accounts').update({ opening_balance_minor: 0 }).neq('opening_balance_minor', 0);
    return error ? FAILED : null;
  } catch {
    return FAILED;
  }
}
