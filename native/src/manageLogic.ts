// Pure rules for adding, renaming and deleting accounts and categories (no React Native, no network). Same rules as the website's
// src/app/actions/accounts.ts and budgets.ts, so both apps agree. Money is integer centavos.
import { parseOptionalMinor } from '../../src/lib/validate.ts';

export const ACCOUNT_TYPES = [
  { id: 'cash', label: 'Cash' },
  { id: 'ewallet', label: 'E-wallet' },
  { id: 'bank', label: 'Bank' },
  { id: 'credit_card', label: 'Credit card' },
  { id: 'savings', label: 'Savings' },
  { id: 'other', label: 'Other' },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]['id'];

export const NAME_MAX = 40;
export const SHORT_MAX = 12;
export const MAX_ACCOUNTS = 60; // DB row caps (migration 0009 / 0012)
export const MAX_CATEGORIES = 150;

const SHORT_RE = /^[a-z0-9][a-z0-9 ]{0,11}$/i;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const key = (s: string) => clean(s).toLowerCase();

export type ExistingAccount = { id: string; name: string; short_name: string | null };
export type AccountDraft = { name: string; type: string; short: string; opening: string };
export type AccountValue = { name: string; account_type: AccountType; short_name: string | null; opening_balance_minor: number };
export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

// A short name ("cc") is typed in Quick Add instead of the full name, so it must be unique across accounts and never equal another account's name.
export function validateAccount(d: AccountDraft, existing: ExistingAccount[], editingId: string | null): Checked<AccountValue> {
  const name = clean(d.name),
    others = existing.filter((a) => a.id !== editingId);
  if (!name) return { ok: false, message: 'Type a name for the account, like "BPI" or "Wallet".' };
  if (name.length > NAME_MAX) return { ok: false, message: `Keep the account name to ${NAME_MAX} characters or fewer.` };
  if (others.some((a) => key(a.name) === key(name)))
    return { ok: false, message: `You already have an account called "${name}". Pick another name.` };
  if (others.some((a) => a.short_name && key(a.short_name) === key(name)))
    return { ok: false, message: `"${name}" is the short name of another account. Pick a different name.` };
  const type = ACCOUNT_TYPES.find((t) => t.id === d.type);
  if (!type) return { ok: false, message: 'Pick an account type.' };
  const short = clean(d.short);
  if (short) {
    if (!SHORT_RE.test(short))
      return { ok: false, message: `A short name is 1 to ${SHORT_MAX} letters, numbers or spaces. Remove symbols or shorten it.` };
    if (others.some((a) => a.short_name && key(a.short_name) === key(short)))
      return { ok: false, message: `"${short}" is already the short name of another account. Pick another.` };
    if (others.some((a) => key(a.name) === key(short)))
      return { ok: false, message: `"${short}" is the name of another account. Pick another short name.` };
  }
  const open = parseOptionalMinor(d.opening);
  if (open === null)
    return { ok: false, message: 'The starting balance is not a valid amount. Use numbers like 1500 or -250.50, or leave it empty for 0.' };
  return { ok: true, value: { name, account_type: type.id, short_name: short || null, opening_balance_minor: open } };
}

export type ExistingCategory = { id: string; name: string; type: 'income' | 'expense' };
export type CategoryValue = { name: string; type: 'income' | 'expense' };

// The type of a category cannot change after it is made, so renaming passes the category's own type.
export function validateCategory(
  d: { name: string; type?: string },
  existing: ExistingCategory[],
  editingId: string | null,
): Checked<CategoryValue> {
  const name = clean(d.name);
  if (d.type !== 'income' && d.type !== 'expense') return { ok: false, message: 'Choose income or expense.' };
  if (!name) return { ok: false, message: 'Type a name for the category, like "Pets".' };
  if (name.length > NAME_MAX) return { ok: false, message: `Keep the category name to ${NAME_MAX} characters or fewer.` };
  if (existing.some((c) => c.id !== editingId && c.type === d.type && key(c.name) === key(name)))
    return { ok: false, message: `You already have a ${d.type} category called "${name}". Pick another name.` };
  return { ok: true, value: { name, type: d.type } };
}

// What to tell the person when a write fails. Never the raw database text. '' means no error.
export function manageError(
  error: { code?: string; message?: string } | null,
  what: 'account' | 'category',
  action: 'save' | 'delete',
): string {
  if (!error) return '';
  const code = error.code ?? '',
    cap = what === 'account' ? MAX_ACCOUNTS : MAX_CATEGORIES;
  if (code === 'PRLIM' || /PRLIM|row limit/i.test(error.message ?? ''))
    return `You have reached the limit of ${cap} ${what === 'account' ? 'accounts' : 'categories'}. Delete one you no longer use to add another.`;
  if (code === '23505') return `You already have ${what === 'account' ? 'an account' : 'a category'} with that name. Pick another name.`;
  if (code === '23503' && action === 'delete')
    return what === 'account'
      ? "This is used by entries, so it can't be deleted. Move or delete those entries first, or rename it instead."
      : "This is used by entries, budgets or repeating entries, so it can't be deleted. Rename it instead.";
  return action === 'delete' ? 'Not deleted: could not reach the server. Try again.' : 'Not saved: could not reach the server. Try again.';
}

// Shown in the confirm dialog: what goes away and what stays. The database refuses the delete while entries still use it.
export function deleteWarning(what: 'account' | 'category', name: string): string {
  return what === 'account'
    ? `Delete "${name}"? Its starting balance goes with it. Savings goals linked to it are kept but become unlinked. If entries still use this account the delete is refused and nothing changes.`
    : `Delete "${name}"? If entries, budgets or repeating entries still use it the delete is refused and nothing changes. Otherwise it is gone for good.`;
}
