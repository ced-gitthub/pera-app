import { supabase } from './supabase';
import type { Snapshot } from './logic';
import {
  BATCH_SIZE,
  MAX_EXPORT_ROWS,
  PAGE_SIZE,
  buildExport,
  importError,
  planImport,
  type ExportTx,
  type ImportPlan,
  type ImportResult,
} from './csvLogic';

// Export: every entry, oldest first, read a page at a time (1000 per page) up to the database's own 50,000 limit.
export async function exportCsv(s: Snapshot): Promise<{ text: string; count: number }> {
  const all: ExportTx[] = [];
  for (let from = 0; all.length < MAX_EXPORT_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('type,amount_minor,transaction_date,description,notes,category_id,account_id,transfer_account_id')
      .order('transaction_date')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('Could not export your entries. Check your connection and try again.');
    all.push(...(data as ExportTx[]));
    if (data.length < PAGE_SIZE) break;
  }
  return buildExport(all.slice(0, MAX_EXPORT_ROWS), s);
}

// Hashes of earlier imports inside the dates of the pasted file, so Check can say how many are already there. Best effort: the database skips them anyway.
async function earlierHashes(range: { from: string; to: string }): Promise<Set<string> | null> {
  const found = new Set<string>();
  for (let from = 0; from < MAX_EXPORT_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('import_hash')
      .not('import_hash', 'is', null)
      .gte('transaction_date', range.from)
      .lte('transaction_date', range.to)
      .order('transaction_date')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) return null;
    for (const x of data) found.add(x.import_hash as string);
    if (data.length < PAGE_SIZE) break;
  }
  return found;
}

export async function checkImport(text: string, s: Snapshot): Promise<{ plan: ImportPlan; dupCheck: boolean }> {
  const first = planImport(text, s);
  if (first.blocked || !first.range || !first.hashes.length) return { plan: first, dupCheck: true };
  const existing = await earlierHashes(first.range);
  if (!existing) return { plan: first, dupCheck: false };
  return { plan: planImport(text, s, existing), dupCheck: true };
}

// Batched upsert on (user_id, import_hash) with ignoreDuplicates: importing the same file twice saves each row once. Stops at the first failed batch and says how far it got.
export async function runImport(plan: ImportPlan): Promise<ImportResult> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { added: 0, dup: plan.dup, problems: plan.problems.length, error: 'Session expired. Please sign in again.' };
  let added = 0;
  let seen = 0;
  for (let i = 0; i < plan.rows.length; i += BATCH_SIZE) {
    const batch = plan.rows.slice(i, i + BATCH_SIZE).map((r) => ({ ...r, user_id: u.user!.id }));
    const { data, error } = await supabase
      .from('transactions')
      .upsert(batch, { onConflict: 'user_id,import_hash', ignoreDuplicates: true })
      .select('id');
    if (error) return { added, dup: plan.dup + seen - added, problems: plan.problems.length, error: importError(error) };
    added += data?.length ?? 0;
    seen += batch.length;
  }
  return { added, dup: plan.dup + plan.rows.length - added, problems: plan.problems.length, error: null };
}
