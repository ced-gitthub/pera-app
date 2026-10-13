// The CSV network logic with the database client passed in, so tests can run it with a fake and no react-native/expo/supabase import.
// csvApi.ts wraps these around the real client.
import {
  BATCH_SIZE,
  MAX_EXPORT_ROWS,
  PAGE_SIZE,
  importError,
  type ExportRange,
  type ExportTx,
  type ImportPlan,
  type ImportResult,
} from './csvLogic.ts';

type DbError = { message: string; code?: string } | null;
type DbResult = { data: Record<string, unknown>[] | null; error: DbError };

// Just the chain these functions call; the real Supabase client fits it.
export type CsvSelect = {
  gte(col: string, v: string): CsvSelect;
  lte(col: string, v: string): CsvSelect;
  order(col: string): CsvSelect;
  range(from: number, to: number): PromiseLike<DbResult>;
};
export type CsvDb = {
  from(table: string): {
    select(cols: string): CsvSelect;
    upsert(
      rows: Record<string, unknown>[],
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ): { select(cols: string): PromiseLike<DbResult> };
  };
};

export const EXPORT_FAILED = 'Could not export your entries. Check your connection and try again.';

// Every entry (inside the range, if given), oldest first, 1000 per page. Stops at the first short page, or at MAX_EXPORT_ROWS.
export async function exportRowsWith(db: CsvDb, range: ExportRange): Promise<ExportTx[]> {
  const all: ExportTx[] = [];
  for (let from = 0; all.length < MAX_EXPORT_ROWS; from += PAGE_SIZE) {
    let q = db
      .from('transactions')
      .select('type,amount_minor,transaction_date,description,notes,category_id,account_id,transfer_account_id');
    if (range.from) q = q.gte('transaction_date', range.from);
    if (range.to) q = q.lte('transaction_date', range.to);
    const { data, error } = await q
      .order('transaction_date')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) throw new Error(EXPORT_FAILED);
    all.push(...(data as unknown as ExportTx[]));
    if (data.length < PAGE_SIZE) break;
  }
  return all.slice(0, MAX_EXPORT_ROWS);
}

// Batched upsert on (user_id, import_hash) with ignoreDuplicates: importing the same file twice saves each row once.
// Stops at the first failed batch and says how many were added before it.
export async function runImportWith(db: CsvDb, userId: string, plan: ImportPlan): Promise<ImportResult> {
  const problems = plan.problems.length;
  if (!userId) return { added: 0, dup: plan.dup, problems, error: 'Session expired. Please sign in again.' };
  let added = 0;
  let seen = 0; // rows in batches that ran
  for (let i = 0; i < plan.rows.length; i += BATCH_SIZE) {
    const batch = plan.rows.slice(i, i + BATCH_SIZE).map((r) => ({ ...r, user_id: userId }));
    const { data, error } = await db
      .from('transactions')
      .upsert(batch, { onConflict: 'user_id,import_hash', ignoreDuplicates: true })
      .select('id');
    if (error) return { added, dup: plan.dup + seen - added, problems, error: importError(error) };
    added += data?.length ?? 0;
    seen += batch.length;
  }
  return { added, dup: plan.dup + seen - added, problems, error: null };
}
