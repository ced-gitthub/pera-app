// "Has the person typed something they have not saved?" for the new-rule form and the account/category form (pure, no react-native).
import type { AccountDraft } from './manageLogic.ts';
import type { RuleForm } from './recurringLogic.ts';

const same = (a: string, b: string) => a.trim() === b.trim();

/** The request id changes per form, so it never counts as a change. Spaces around text do not count either. */
export function isRuleDraftDirty(initial: RuleForm, current: RuleForm): boolean {
  return (
    initial.type !== current.type ||
    !same(initial.amount, current.amount) ||
    !same(initial.description, current.description) ||
    initial.accountId !== current.accountId ||
    initial.categoryId !== current.categoryId ||
    initial.frequency !== current.frequency ||
    !same(initial.interval, current.interval) ||
    !same(initial.start, current.start)
  );
}

export type ManageDraft = { kind: 'account' | 'category'; account: AccountDraft; catName: string; catType: 'income' | 'expense' };

/** Only the fields of the kind being edited count (an account form ignores the category fields and the reverse). */
export function isManageDraftDirty(initial: ManageDraft, current: ManageDraft): boolean {
  if (initial.kind !== current.kind) return true;
  if (current.kind === 'category') return !same(initial.catName, current.catName) || initial.catType !== current.catType;
  const a = initial.account;
  const b = current.account;
  return !same(a.name, b.name) || a.type !== b.type || !same(a.short, b.short) || !same(a.opening, b.opening);
}
