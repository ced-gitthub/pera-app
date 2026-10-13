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
  const all = '(including real ones, not just sample data)';
  if (kind === 'entries')
    return (
      `Deletes ${plural(count, 'entry', 'entries')} ${all}. Your accounts, categories, budgets and goals stay. ` +
      'Account balances go back to their starting balances. Your streak, XP and level go back to the start, because they are worked out from entries. ' +
      'Progress of goals that are not linked to an account drops, because it is income minus expenses. ' +
      'Recurring rules stay and will keep adding new entries. ' +
      'Deleted entries are kept for 30 days in a hidden trash, but the app cannot restore a whole batch.'
    );
  if (kind === 'budgets')
    return (
      `Deletes ${plural(count, 'budget', 'budgets')} ${all}. Your entries, accounts, categories and goals stay. ` +
      'Your spending is no longer tracked against a limit until you make new budgets. This cannot be undone.'
    );
  return (
    `Deletes ${plural(count, 'savings goal', 'savings goals')} ${all}. Your entries, accounts, categories and budgets stay. ` +
    'You will no longer see their progress. This cannot be undone.'
  );
}

export const confirmPhrase = (_kind: ResetKind): string => 'DELETE';

export const canConfirm = (typed: string, kind: ResetKind): boolean => typed.trim().toLowerCase() === confirmPhrase(kind).toLowerCase();

// Never shows raw database text.
export function resetError(error: unknown): string {
  const e = (error ?? {}) as { message?: unknown; code?: unknown };
  const msg = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  // Checked first: a database statement timeout is its own case, not a lost connection.
  if (code === '57014' && /statement timeout/i.test(msg))
    return 'That is too many rows to delete in one go, so nothing was deleted. Delete them in smaller parts (open Activity and delete entries, or use Reports/CSV to export first), then try again.';
  // The request may have reached the server and only the answer was lost, so never claim nothing was deleted.
  if (/fetch|network|timed? ?out|offline/i.test(msg)) return 'Could not confirm that. Check the numbers below once they load.';
  if (/jwt|expired|not authenticated/i.test(msg) || code === 'PGRST301' || code === 'PGRST303')
    return 'Your session ended. Nothing was deleted. Please sign in again.';
  if (code === '42501' || /row-level security|permission denied/i.test(msg))
    return 'Zovix could not delete that. If you use two-step sign in, finish it first. Nothing was deleted.';
  return 'Could not delete right now. Either all of them were deleted or none were. Check the numbers below, then try again.';
}
