// Sample-entry writes with the database client passed in, so tests can use a fake (no react-native, no supabase import).
import { createEntryWith, type Db, type Query } from './entriesCore.ts';
import { SAMPLE_FAIL, SAMPLE_IDS, SAMPLE_LABEL, SAMPLE_REMOVE_FAIL, type SampleRow } from './sampleLogic.ts';

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
