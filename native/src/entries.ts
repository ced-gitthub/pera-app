import { supabase } from './supabase';
import { restoreRowOf, type TxPatch } from './logic';
import { entryError } from './entriesLogic';

const SESSION = 'Session expired. Please sign in again.';
const GONE = 'That entry no longer exists. Pull down to refresh the list.';

// The destination account of a transfer is not in the list rows, so the edit sheet reads it here. null = unknown (the sheet then asks for it).
export async function loadTransferTarget(id: string): Promise<string | null> {
  const { data } = await supabase.from('transactions').select('transfer_account_id').eq('id', id).maybeSingle();
  return (data?.transfer_account_id as string | null | undefined) ?? null;
}

// Returns null when saved, otherwise a message that says what happened.
export async function updateEntry(id: string, patch: TxPatch): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('transactions').update(patch).eq('id', id).select('id');
    if (error) return entryError(error, 'save');
    return data?.length ? null : GONE;
  } catch {
    return entryError({ message: 'network' }, 'save');
  }
}

// Deletes one entry and hands back the deleted row so Undo can put it back. The database also keeps a copy in tx_trash.
export async function deleteEntry(id: string): Promise<{ row: Record<string, unknown> } | { error: string }> {
  try {
    const { data, error } = await supabase.from('transactions').delete().eq('id', id).select('*');
    if (error) return { error: entryError(error, 'delete') };
    if (!data?.length) return { error: GONE };
    return { row: data[0] as Record<string, unknown> };
  } catch {
    return { error: entryError({ message: 'network' }, 'delete') };
  }
}

// Undo a delete. Re-inserting the same id is safe to repeat (a second tap changes nothing), and the count confirms it is really back.
export async function restoreEntry(row: Record<string, unknown>): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return SESSION;
    const r = restoreRowOf(row, u.user.id);
    if (typeof r.id !== 'string') return entryError({ message: 'no id' }, 'restore');
    if (r.recurring_id) {
      const { data } = await supabase
        .from('recurring_transactions')
        .select('id')
        .eq('id', r.recurring_id as string)
        .maybeSingle();
      if (!data) delete r.recurring_id; // the rule was deleted since
    }
    const { error } = await supabase.from('transactions').upsert(r, { onConflict: 'id', ignoreDuplicates: true });
    if (error) return entryError(error, 'restore');
    const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('id', r.id);
    if (count !== 1) return entryError({ message: 'missing' }, 'restore');
    await supabase.from('tx_trash').delete().eq('tx_id', r.id); // best effort: the copy is spent
    return null;
  } catch {
    return entryError({ message: 'network' }, 'restore');
  }
}
