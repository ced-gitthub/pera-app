// Pure: has the person changed an entry form since it was opened? (text fields compared after trimming)
import type { TxEdit } from './logic.ts';

export function isEntryDirty(initial: TxEdit | null, current: TxEdit | null): boolean {
  if (!initial || !current) return false;
  return (
    initial.type !== current.type ||
    initial.amount.trim() !== current.amount.trim() ||
    initial.date.trim() !== current.date.trim() ||
    initial.description.trim() !== current.description.trim() ||
    initial.accountId !== current.accountId ||
    initial.categoryId !== current.categoryId ||
    initial.toId !== current.toId
  );
}
