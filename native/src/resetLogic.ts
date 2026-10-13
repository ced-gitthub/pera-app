// Pure rules for the "Delete all ..." tools: what each one deletes, what the person must type, and friendly errors. No react-native imports.
export const RESET_KINDS = ['entries', 'budgets', 'goals'] as const;
export type ResetKind = (typeof RESET_KINDS)[number];

export const RESET_LABEL: Record<ResetKind, string> = {
  entries: 'Delete all entries',
  budgets: 'Delete all budgets',
  goals: 'Delete all savings goals',
};

const plural = (n: number, one: string, many: string) => (n === 1 ? `the 1 ${one}` : `all ${n} ${many}`);

export function resetWarning(kind: ResetKind, count: number): string {
  if (kind === 'entries')
    return (
      `Deletes ${plural(count, 'entry', 'entries')}. Your accounts, categories, budgets and goals stay. ` +
      'Account balances go back to their starting balances. Deleted entries are kept for 30 days in a hidden trash, ' +
      'but the app cannot restore a whole batch.'
    );
  if (kind === 'budgets')
    return `Deletes ${plural(count, 'budget', 'budgets')}. Your entries, accounts, categories and goals stay. This cannot be undone.`;
  return `Deletes ${plural(count, 'savings goal', 'savings goals')}. Your entries, accounts, categories and budgets stay. This cannot be undone.`;
}

export const confirmPhrase = (_kind: ResetKind): string => 'DELETE';

export const canConfirm = (typed: string, kind: ResetKind): boolean => typed.trim().toLowerCase() === confirmPhrase(kind).toLowerCase();

// Never shows raw database text.
export function resetError(error: unknown): string {
  const e = (error ?? {}) as { message?: unknown; code?: unknown };
  const msg = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  if (/fetch|network|timed? ?out|offline/i.test(msg)) return 'No connection. Nothing was deleted. Check your internet and try again.';
  if (/jwt|expired|not authenticated/i.test(msg) || code === 'PGRST301' || code === 'PGRST303')
    return 'Your session ended. Nothing was deleted. Please sign in again.';
  if (code === '42501' || /row-level security|permission denied/i.test(msg))
    return 'Zovix could not delete that. If you use two-step sign in, finish it first. Nothing was deleted.';
  return 'Could not delete right now. Some items may be gone, so reopen this screen to check, then try again.';
}
