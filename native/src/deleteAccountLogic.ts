// Words for the two kinds of deleting, plus how to read the server's answer to "delete my account". Pure, so it is unit-tested.

// 1) Delete my records: clears what you logged. The login and the setup stay.
export const RECORDS_DELETE = [
  'Choose which records to clear: all entries, all budgets, or all goals.',
  'Your login stays, and so do your accounts (Cash, GCash...) and categories. Accounts keep their starting balances.',
  'Use this to clear test entries and start tracking for real.',
];

// 2) Delete my account: everything, including the login.
export const ACCOUNT_DELETES = [
  'Permanently deletes your Zovix account and everything in it: your login, all accounts, categories, entries, budgets, goals, recurring rules and settings.',
  'It also clears the hidden 30-day trash, so deleted entries cannot be brought back.',
  'This cannot be undone and there is no way to undo it. You can sign up again later, but you will start from zero.',
  'For your safety you must have signed in within the last 10 minutes. If not, log out, sign in again, then come back.',
];

export const canDeleteAccount = (typed: string) => typed.trim().toUpperCase() === 'DELETE';

export type DeleteOutcome =
  | { kind: 'deleted' }
  | { kind: 'unavailable'; message: string } // the server does not have this feature yet
  | { kind: 'error'; message: string };

const TRY_AGAIN = 'Could not delete your account. Nothing was removed. Check your connection and try again.';
const UNAVAILABLE =
  'Deleting your account from the app is not available yet. Use the website: sign in, open Security and choose Delete account.';

// Only messages the server wrote for people (403 and 400 rules) are shown as they are; a server error (5xx) or anything unreadable becomes a fixed sentence.
export function interpretDeleteResponse(status: number, body: unknown): DeleteOutcome {
  if (status === 200 && typeof body === 'object' && body !== null && (body as { ok?: unknown }).ok === true) return { kind: 'deleted' };
  if (status === 404) return { kind: 'unavailable', message: UNAVAILABLE };
  const msg = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined;
  if ((status === 400 || status === 401 || status === 403 || status === 503) && typeof msg === 'string' && msg.length < 200)
    return { kind: 'error', message: msg };
  return { kind: 'error', message: TRY_AGAIN };
}
