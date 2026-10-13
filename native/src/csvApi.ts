import { supabase } from './supabase';
import type { Snapshot } from './logic';
import { exportRowsWith, runImportWith, type CsvDb } from './csvCore';
import { MAX_EXPORT_ROWS, PAGE_SIZE, buildExport, planImport, type ExportRange, type ImportPlan, type ImportResult } from './csvLogic';

// The real client, seen through the small chain csvCore uses.
const db = supabase as unknown as CsvDb;

// Export: entries oldest first, read a page at a time (1000 per page) up to the database's own 50,000 limit, optionally inside a date range.
export async function exportCsv(s: Snapshot, range: ExportRange = {}): Promise<{ text: string; count: number }> {
  const rows = await exportRowsWith(db, range);
  return buildExport(rows, s, range);
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

export async function runImport(plan: ImportPlan): Promise<ImportResult> {
  const { data: u } = await supabase.auth.getUser();
  return runImportWith(db, u.user?.id ?? '', plan);
}
