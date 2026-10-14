// Sample-entry writes with the database client passed in, so tests can use a fake (no react-native, no supabase import).
import type { Db, Query } from './entriesCore.ts';
import { SAMPLE_FAIL, SAMPLE_IDS, SAMPLE_LABEL, SAMPLE_REMOVE_FAIL, type SampleRow } from './sampleLogic.ts';

// FAST: one request writes all the rows (retry-safe: the same fixed request ids save once) and one request confirms they are all there.
// Returns null when all are saved, otherwise a message.
export async function addSampleWith(db: Db, userId: string, rows: SampleRow[]): Promise<string | null> {
  try {
    if (!userId || !rows.length) return SAMPLE_FAIL;
    const payload = rows.map((r) => ({ ...r.patch, user_id: userId, request_id: r.requestId, request_idx: 0 }));
    const { error } = await db.from('transactions').upsert(payload, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true });
    if (error) return SAMPLE_FAIL;
    const { count, error: countError } = await db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .in(
        'request_id',
        rows.map((r) => r.requestId),
      );
    return countError || count !== rows.length ? SAMPLE_FAIL : null;
  } catch {
    return SAMPLE_FAIL;
  }
}

// Deletes only this user's rows whose request id is one of the fixed sample ids AND whose description still starts with "Sample:" (an entry the
// person edited into a real one is left alone). Then counts what is left: a delete that row-level security filtered to nothing is not a success.
export async function removeSampleWith(db: Db, userId: string): Promise<string | null> {
  try {
    if (!userId) return SAMPLE_REMOVE_FAIL;
    const mine = (q: Query) => q.eq('user_id', userId).in('request_id', SAMPLE_IDS).like('description', SAMPLE_LABEL + '%');
    const { error } = await mine(db.from('transactions').delete()).select('id');
    if (error) return SAMPLE_REMOVE_FAIL;
    const { count, error: countError } = await mine(db.from('transactions').select('id', { count: 'exact', head: true }));
    return countError || count !== 0 ? SAMPLE_REMOVE_FAIL : null;
  } catch {
    return SAMPLE_REMOVE_FAIL;
  }
}

// How many untouched sample entries this person still has (same filters as the delete). null when it could not be counted.
export async function countSampleWith(db: Db, userId: string): Promise<number | null> {
  try {
    if (!userId) return null;
    const { count, error } = await db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('request_id', SAMPLE_IDS)
      .like('description', SAMPLE_LABEL + '%');
    return error || typeof count !== 'number' ? null : count;
  } catch {
    return null;
  }
}

// Starts sample entries safely. The "pending" flag is stored FIRST, so even if the app dies mid-way the Keep / Clear question still appears.
// If adding fails part-way, the partial rows are removed; the flag is cleared only when that clean-up worked. Returns null on success.
export async function startSamplesWith(p: {
  setPending: (on: boolean) => Promise<unknown> | void;
  add: () => Promise<string | null>;
  remove: () => Promise<string | null>;
}): Promise<string | null> {
  await p.setPending(true);
  const m = await p.add();
  if (!m) return null;
  if (!(await p.remove())) await p.setPending(false);
  return m;
}
