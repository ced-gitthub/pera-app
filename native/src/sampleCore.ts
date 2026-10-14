// Sample-entry writes with the database client passed in, so tests can use a fake (no react-native, no supabase import).
import { createEntryWith, type Db } from './entriesCore.ts';
import { SAMPLE_FAIL, SAMPLE_IDS, SAMPLE_REMOVE_FAIL, type SampleRow } from './sampleLogic.ts';

// Each row is retry-safe (same request id saves once). Returns null when all are saved, otherwise a message.
export async function addSampleWith(db: Db, userId: string, rows: SampleRow[]): Promise<string | null> {
  try {
    if (!userId || !rows.length) return SAMPLE_FAIL;
    for (const r of rows) if (await createEntryWith(db, userId, r.patch, r.requestId)) return SAMPLE_FAIL;
    return null;
  } catch {
    return SAMPLE_FAIL;
  }
}

// Deletes only this user's rows whose request id is one of the fixed sample ids. Returns null on success.
export async function removeSampleWith(db: Db, userId: string): Promise<string | null> {
  try {
    if (!userId) return SAMPLE_REMOVE_FAIL;
    const { error } = await db.from('transactions').delete().eq('user_id', userId).in('request_id', SAMPLE_IDS).select('id');
    return error ? SAMPLE_REMOVE_FAIL : null;
  } catch {
    return SAMPLE_REMOVE_FAIL;
  }
}
