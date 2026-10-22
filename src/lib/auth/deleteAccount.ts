import { recentSignIn } from './session.ts';
// Rules for deleting an account from the native app (the website has its own form, see actions/auth.ts deleteMyAccount). Pure, so they are unit-tested.
export type DeleteCheck = {
  confirm: string; // what the person typed
  adminReady: boolean; // the server has the key it needs
  hasVerifiedFactor: boolean; // the account uses two-step verification
  aal: string | undefined; // the session's assurance level from its access token
  signedInAt: string | undefined; // when THIS session authenticated (the token's amr timestamp)
  now: number;
};
export type DeleteVerdict = { ok: true } | { ok: false; status: 400 | 403 | 503; error: string };

export function checkDeleteRequest(c: DeleteCheck): DeleteVerdict {
  if (c.confirm.trim() !== 'DELETE') return { ok: false, status: 400, error: 'Type DELETE in capital letters to confirm.' };
  if (!c.adminReady) return { ok: false, status: 503, error: 'Account deletion is not available right now. Please try again later.' };
  // A session that has not passed the second step must never delete an account that has two-step verification.
  if (c.hasVerifiedFactor && c.aal !== 'aal2')
    return { ok: false, status: 403, error: 'Finish two-step verification first, then try again.' };
  if (!recentSignIn(c.signedInAt, c.now))
    return { ok: false, status: 403, error: 'For your safety, log out, sign in again, then delete your account within 10 minutes.' };
  return { ok: true };
}

// The access token's "aal" claim ('aal1' = signed in, 'aal2' = also passed two-step). undefined when unreadable.
export function tokenAal(accessToken: string | null | undefined): string | undefined {
  try {
    const p = JSON.parse(Buffer.from((accessToken ?? '').split('.')[1] ?? '', 'base64url').toString('utf8')) as { aal?: unknown };
    return typeof p.aal === 'string' ? p.aal : undefined;
  } catch {
    return undefined;
  }
}

export function bearerToken(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m ? m[1] : null;
}

// Any verified second factor (authenticator app, phone, security key, or a type added later) means the account uses two-step verification.
export const hasVerifiedFactor = (factors: { factor_type?: string; status?: string }[] | null | undefined): boolean =>
  (factors ?? []).some((f) => f.status === 'verified');

// Deletes the user through the database function from migration 0013 (the auth admin API rejects the server's key). Returns null on success, else a safe message.
// `client` is the secret-key Supabase client: execute on the function is granted to the server role only.
export async function deleteViaRpc(
  client: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> },
  userId: string,
  log: (cause: unknown) => void = () => {},
): Promise<string | null> {
  if (!userId) return 'We could not delete your account. Nothing was removed. Please try again.';
  try {
    const { error } = await client.rpc('delete_user_account', { p_user: userId });
    if (error) log(error); // the real database error goes to the server log, never to the person
    return error ? 'We could not delete your account. Nothing was removed. Please try again.' : null;
  } catch (e) {
    log(e);
    return 'We could not delete your account. Nothing was removed. Please try again.';
  }
}
