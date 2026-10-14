// Pure rules for the "Delete all ..." tools: what each one deletes, what the person must type, and friendly errors. No react-native imports.
export const RESET_KINDS = ['entries', 'budgets', 'goals', 'recurring'] as const;
export type ResetKind = (typeof RESET_KINDS)[number];

export type ResetChoice = ResetKind | 'all';
// Everything "all" clears, in order: the four kinds, then every account's starting balance (a step, not a table of rows).
export type ResetStep = ResetKind | 'balances';
export type Counts = Record<ResetKind, number | null>;

export const RESET_LABEL: Record<ResetChoice, string> = {
  all: 'Delete ALL my records',
  entries: 'Delete all entries',
  budgets: 'Delete all budgets',
  goals: 'Delete all savings goals',
  recurring: 'Delete all recurring rules',
};

const plural = (n: number, one: string, many: string) => (n === 1 ? `the 1 ${one}` : `all ${n} ${many}`);

// Sum of the three counts; null when any is unknown.
export const sumCounts = (c: Counts): number | null =>
  c.entries === null || c.budgets === null || c.goals === null || c.recurring === null
    ? null
    : c.entries + c.budgets + c.goals + c.recurring;

export function allWarning(c: { entries: number; budgets: number; goals: number; recurring: number }): string {
  return (
    `Deletes ${plural(c.entries, 'entry', 'entries')}, ${plural(c.budgets, 'budget', 'budgets')}, ${plural(c.goals, 'savings goal', 'savings goals')} and ${plural(c.recurring, 'recurring rule', 'recurring rules')} (including real ones, not just sample data). ` +
    'The starting balance of every account is set to 0, so every account shows 0. Your login, accounts and categories stay (empty), so you can keep using the app. ' +
    'Your streak, XP and level go back to the start. Budget and goal tracking is gone. ' +
    'Deleted entries are kept for 30 days in a hidden trash, but the app cannot restore a whole batch. ' +
    'This cannot be undone. It is not the same as deleting your account: you stay signed up and can start again.'
  );
}

export function resetWarning(kind: ResetChoice, count: number | Counts): string {
  if (kind === 'all') {
    const c = typeof count === 'number' ? { entries: 0, budgets: 0, goals: 0, recurring: 0 } : count;
    return allWarning({ entries: c.entries ?? 0, budgets: c.budgets ?? 0, goals: c.goals ?? 0, recurring: c.recurring ?? 0 });
  }
  if (typeof count !== 'number') return '';
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
  if (kind === 'recurring')
    return (
      `Deletes ${plural(count, 'recurring rule', 'recurring rules')} ${all}. Your entries, accounts, categories, budgets and goals stay. ` +
      'Nothing new is added automatically until you make a new rule. This cannot be undone.'
    );
  return (
    `Deletes ${plural(count, 'savings goal', 'savings goals')} ${all}. Your entries, accounts, categories and budgets stay. ` +
    'You will no longer see their progress. This cannot be undone.'
  );
}

export const confirmPhrase = (_kind: ResetChoice): string => 'DELETE';

export const canConfirm = (typed: string, kind: ResetChoice): boolean => typed.trim().toLowerCase() === confirmPhrase(kind).toLowerCase();

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

const NAME: Record<ResetStep, string> = {
  recurring: 'recurring rules',
  budgets: 'budgets',
  goals: 'goals',
  entries: 'entries',
  balances: 'starting balances',
};
const list = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]);
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const ORDER: ResetStep[] = ['recurring', 'budgets', 'goals', 'entries', 'balances'];

// Plain words about a delete-all that stopped part way. `reason` is already friendly text.
export function partialMessage(done: ResetStep[], reason: string): string {
  if (done.length === 0) return reason;
  const left = ORDER.filter((k) => !done.includes(k)).map((k) => NAME[k]);
  return `${cap(list(ORDER.filter((k) => done.includes(k)).map((k) => NAME[k])))} were deleted, ${list(left)} were not. Check the numbers below, then try again.`;
}
