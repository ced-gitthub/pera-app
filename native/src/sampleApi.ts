import { supabase } from './supabase';
import type { Db } from './entriesCore';
import { addSampleWith, countSampleWith, removeSampleWith } from './sampleCore';
import { setSamplePending } from './flags';
import { SAMPLE_FAIL, SAMPLE_REMOVE_FAIL, buildSampleRows } from './sampleLogic';
import type { Snapshot } from './logic';
import { manilaToday } from '../../src/core/money';

const db = supabase as unknown as Db;

// Both return null when done, otherwise a message.
export async function addSamples(snap: Snapshot): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getSession();
    if (!u.session) return SAMPLE_FAIL;
    return await addSampleWith(db, u.session.user.id, buildSampleRows(snap.accounts, snap.categories, manilaToday()));
  } catch {
    return SAMPLE_FAIL;
  }
}
export async function removeSamples(): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getSession();
    if (!u.session) return SAMPLE_REMOVE_FAIL;
    const m = await removeSampleWith(db, u.session.user.id);
    if (!m) await setSamplePending(u.session.user.id, false); // they are gone: the Keep / Clear question is settled too
    return m;
  } catch {
    return SAMPLE_REMOVE_FAIL;
  }
}
/** How many sample entries are still in the account (null if unknown). */
export async function countSamples(): Promise<number | null> {
  try {
    const { data: u } = await supabase.auth.getSession();
    return u.session ? await countSampleWith(db, u.session.user.id) : null;
  } catch {
    return null;
  }
}
