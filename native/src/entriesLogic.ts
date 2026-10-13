// Pure helpers for the entry sheet (no React Native, no network) so `npm test` can run them.
import { minorToInput } from '../../src/lib/validate.ts';
import type { Category, Tx, TxEdit } from './logic.ts';

export const UNDO_MS = 8000;

const FAIL: Record<'save' | 'delete' | 'restore', string> = {
  save: 'Not saved: the server refused it or could not be reached. Try again.',
  delete: 'Not deleted: the server refused it or could not be reached. Try again.',
  restore: 'Could not bring it back: the server refused it or could not be reached. Try again.',
};
// Friendly text for a failed write. Raw database messages are never shown.
export function entryError(error: { message: string; code?: string }, what: 'save' | 'delete' | 'restore'): string {
  if (error.code === 'PRLIM' || /PRLIM/.test(error.message)) return 'You reached the limit for entries. Delete some old ones first.';
  if (what === 'restore' && error.code === '23503') return "Can't bring it back: its account or category was deleted since.";
  return FAIL[what];
}

// The sheet's starting values for an entry. The amount is shown from integer centavos with no float math.
export function formOf(tx: Tx): TxEdit {
  return {
    type: tx.type,
    amount: minorToInput(tx.amount_minor),
    date: tx.transaction_date,
    description: tx.description ?? '',
    accountId: tx.account_id ?? '',
    toId: '',
    categoryId: tx.category_id ?? '',
  };
}

export const categoriesFor = (type: TxEdit['type'], cats: Category[]): Category[] =>
  type === 'transfer' ? [] : cats.filter((x) => x.type === type);

// Changing the type drops a category that belongs to the other type, and the to-account unless it is a transfer.
export function switchType(f: TxEdit, type: TxEdit['type'], cats: Category[]): TxEdit {
  const keep = type !== 'transfer' && cats.some((x) => x.id === f.categoryId && x.type === type);
  return { ...f, type, categoryId: keep ? f.categoryId : '', toId: type === 'transfer' ? f.toId : '' };
}
