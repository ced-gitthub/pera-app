// Recurring-rule database logic with an injected db, so it can be tested without react-native or a network.
// recurringApi.ts wires in the real Supabase client; tests wire in an in-memory fake.
import { addDays, isDate, manilaToday } from '../../src/core/money.ts';
import { recurringError, resumePlan, type RuleRow } from './recurringLogic.ts';

export type DbError = { message: string; code?: string };
export type DbResult = { data: unknown; error: DbError | null };
// The small slice of the Supabase query builder we use.
export interface Query extends PromiseLike<DbResult> {
  select(columns: string): Query;
  eq(column: string, value: unknown): Query;
  single(): Query;
  insert(values: Record<string, unknown>): Query;
  update(values: Record<string, unknown>): Query;
  delete(): Query;
}
export interface Db {
  from(table: string): Query;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult>;
}

const TABLE = 'recurring_transactions';
export const SCHEDULE_COLS = 'start_date,frequency,interval_count,end_date,run_count';

// Retry-safe: the row id is made once per form, so sending the same rule twice saves it once (a duplicate id means it already saved).
export async function createRuleWith(db: Db, userId: string, row: RuleRow): Promise<string | null> {
  const { error } = await db.from(TABLE).insert({ ...row, user_id: userId });
  if (error && error.code === '23505') return null;
  return recurringError(error);
}

// Pausing only flips `active`. Resuming also moves the rule's position to the first date on or after today, in the SAME update,
// so the dates missed while paused are skipped instead of being added all at once.
export async function setRuleActiveWith(db: Db, rule: { id: string }, active: boolean, today: string | null): Promise<string | null> {
  const failed = 'Could not change that rule. Check your connection and try again.';
  if (!active) {
    const { error } = await db.from(TABLE).update({ active: false }).eq('id', rule.id);
    return error ? failed : null;
  }
  if (today === null || !isDate(today)) return DATE_UNCONFIRMED; // resuming needs the real date
  const { data, error: loadError } = await db.from(TABLE).select(SCHEDULE_COLS).eq('id', rule.id).single();
  const r = data as { start_date: string; frequency: string; interval_count: number; end_date: string | null; run_count: number } | null;
  if (loadError || !r) return failed;
  const plan = resumePlan(r, today);
  if (!plan.active) return `This rule ended on ${r.end_date}, so it can't be resumed. Change its end date or add a new rule.`;
  const { error } = await db
    .from(TABLE)
    .update({ active: plan.active, run_count: plan.run_count, next_run_date: plan.next_run_date })
    .eq('id', rule.id);
  return error ? failed : null;
}

// Entries the rule already made stay (their link to the rule is cleared by the database, not deleted).
export async function deleteRuleWith(db: Db, id: string): Promise<string | null> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  return error ? 'Could not delete that rule. Check your connection and try again.' : null;
}

export const DATE_UNCONFIRMED = "Could not confirm today's date. Recurring entries will run next time.";

// Makes every entry that is due up to `today`. Safe to run again: it never makes the same entry twice.
// `today` should come from the server clock; it is never allowed to be more than 1 day past the device date.
export async function runDueWith(
  db: Db,
  today: string,
  deviceToday: string = manilaToday(),
): Promise<{ created: number; error: string | null }> {
  if (!isDate(today) || !isDate(deviceToday)) return { created: 0, error: DATE_UNCONFIRMED };
  const latest = addDays(deviceToday, 1);
  const { data, error } = await db.rpc('run_recurring', { p_today: today > latest ? latest : today });
  if (error) return { created: 0, error: 'Could not run your recurring rules right now. Try again in a moment.' };
  return { created: Number(data ?? 0), error: null };
}
