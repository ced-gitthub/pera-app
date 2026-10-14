// The entry write paths with the database client passed in, so tests can use a fake (no react-native, no supabase import).
import { entryError } from './entriesLogic.ts';
import { restoreRowOf, type TxPatch } from './logic.ts';

export const GONE = 'That entry no longer exists. Pull down to refresh the list.';

type Res = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
// The few chainable calls the entry writes use. The real Supabase client satisfies this.
export interface Query extends PromiseLike<Res> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): Query;
  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): Query;
  update(values: Record<string, unknown>): Query;
  delete(): Query;
  eq(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
  like(column: string, pattern: string): Query;
  maybeSingle(): PromiseLike<Res>;
}
export interface Db {
  from(table: string): Query;
}

// Returns null when saved, otherwise a message that says what happened.
export async function updateEntryWith(db: Db, id: string, patch: TxPatch): Promise<string | null> {
  try {
    const { data, error } = await db.from('transactions').update(patch).eq('id', id).select('id');
    if (error) return entryError(error, 'save');
    return Array.isArray(data) && data.length ? null : GONE;
  } catch {
    return entryError({ message: 'network' }, 'save');
  }
}

// Adds one entry by hand. Retry-safe: the same requestId sent twice saves once (unique user_id + request_id + request_idx),
// and the count confirms it is really there. Returns null when saved, otherwise a message.
export async function createEntryWith(db: Db, userId: string, patch: TxPatch, requestId: string): Promise<string | null> {
  try {
    const row = { ...patch, user_id: userId, request_id: requestId, request_idx: 0 };
    const { error } = await db.from('transactions').upsert(row, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true });
    if (error) return entryError(error, 'save');
    const { count, error: countError } = await db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', requestId);
    if (countError || count !== 1) return entryError({ message: 'missing' }, 'save');
    return null;
  } catch {
    return entryError({ message: 'network' }, 'save');
  }
}

// Deletes one entry and hands back the deleted row so Undo can put it back. The database also keeps a copy in tx_trash.
export async function deleteEntryWith(db: Db, id: string): Promise<{ row: Record<string, unknown> } | { error: string }> {
  try {
    const { data, error } = await db.from('transactions').delete().eq('id', id).select('*');
    if (error) return { error: entryError(error, 'delete') };
    if (!Array.isArray(data) || !data.length) return { error: GONE };
    return { row: data[0] as Record<string, unknown> };
  } catch {
    return { error: entryError({ message: 'network' }, 'delete') };
  }
}

// Undo a delete. Re-inserting the same id is safe to repeat (a second tap changes nothing), the count confirms it is
// really back, and the trash copy is removed only after that.
export async function restoreEntryWith(db: Db, userId: string, row: Record<string, unknown>): Promise<string | null> {
  try {
    const r = restoreRowOf(row, userId);
    if (typeof r.id !== 'string') return entryError({ message: 'no id' }, 'restore');
    if (r.recurring_id) {
      const { data } = await db
        .from('recurring_transactions')
        .select('id')
        .eq('id', r.recurring_id as string)
        .maybeSingle();
      if (!data) delete r.recurring_id; // the rule was deleted since
    }
    const { error } = await db.from('transactions').upsert(r, { onConflict: 'id', ignoreDuplicates: true });
    if (error) return entryError(error, 'restore');
    const { count, error: countError } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('id', r.id);
    if (countError || count !== 1) return entryError({ message: 'missing' }, 'restore');
    try {
      await db.from('tx_trash').delete().eq('tx_id', r.id); // best effort: the copy is spent
    } catch {
      // the entry is back; a leftover trash copy is harmless
    }
    return null;
  } catch {
    return entryError({ message: 'network' }, 'restore');
  }
}
