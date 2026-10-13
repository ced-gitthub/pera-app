import { supabase } from './supabase';
import type { TxPatch } from './logic';
import { entryError } from './entriesLogic';
import { deleteEntryWith, restoreEntryWith, updateEntryWith, type Db } from './entriesCore';

const SESSION = 'Session expired. Please sign in again.';

// The real client has far richer types than the few calls the entry writes use, so it is narrowed once here.
const db = supabase as unknown as Db;

// The destination account of a transfer is not in the list rows, so the edit sheet reads it here. null = unknown (the sheet then asks for it).
export async function loadTransferTarget(id: string): Promise<string | null> {
  const { data } = await supabase.from('transactions').select('transfer_account_id').eq('id', id).maybeSingle();
  return (data?.transfer_account_id as string | null | undefined) ?? null;
}

// Returns null when saved, otherwise a message that says what happened.
export const updateEntry = (id: string, patch: TxPatch): Promise<string | null> => updateEntryWith(db, id, patch);

// Deletes one entry and hands back the deleted row so Undo can put it back.
export const deleteEntry = (id: string): Promise<{ row: Record<string, unknown> } | { error: string }> => deleteEntryWith(db, id);

// Undo a delete. Returns null when it is back (or already was), otherwise a message.
export async function restoreEntry(row: Record<string, unknown>): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return SESSION;
    return await restoreEntryWith(db, u.user.id, row);
  } catch {
    return entryError({ message: 'network' }, 'restore');
  }
}
