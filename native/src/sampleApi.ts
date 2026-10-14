import { supabase } from './supabase';
import type { Db } from './entriesCore';
import { addSampleWith, removeSampleWith } from './sampleCore';
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
    return await removeSampleWith(db, u.session.user.id);
  } catch {
    return SAMPLE_REMOVE_FAIL;
  }
}
