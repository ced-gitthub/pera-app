import { interpretDeleteResponse, type DeleteOutcome } from './deleteAccountLogic.ts';

// Asks the website's server to delete the signed-in account (only the server holds the key that can). `doFetch` is injected so this runs in tests.
// The call is made exactly once: if the answer is lost the person is told it could not be confirmed, and can check by trying to sign in.
export async function requestAccountDeletion(
  doFetch: typeof fetch,
  siteUrl: string,
  accessToken: string,
  typed: string,
): Promise<DeleteOutcome> {
  if (!accessToken) return { kind: 'error', message: 'Your session has ended. Sign in again, then try deleting your account.' };
  try {
    const res = await doFetch(`${siteUrl.replace(/\/+$/, '')}/api/native/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: typed.trim().toUpperCase() }),
    });
    const body: unknown = await res.json().catch(() => null);
    return interpretDeleteResponse(res.status, body);
  } catch {
    return {
      kind: 'unconfirmed',
      message: 'Could not confirm that. Check your connection, then sign in to see whether the account still exists.',
    };
  }
}
