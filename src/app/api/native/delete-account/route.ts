import { NextResponse } from 'next/server';
import { admin, adminConfigured } from '@/lib/admin/admin';
import { bearerToken, checkDeleteRequest, deleteViaRpc, hasVerifiedFactor, tokenAal } from '@/lib/auth/deleteAccount';
import { sessionSignInAt } from '@/lib/auth/session';
import { logErr } from '@/lib/common/safe';

// Lets the native app delete the signed-in person's account (required by Google Play / App Store). The secret key lives only on the server, so the app cannot do this itself.
// Auth is the person's own access token in the Authorization header (no cookies). Rules live in lib/auth/deleteAccount.ts: typed DELETE, a session that signed in within 10 minutes,
// and a two-step session for accounts that use two-step verification. All data goes with the user through the database's cascade rules.
export const dynamic = 'force-dynamic';

const reply = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const token = bearerToken(req.headers.get('authorization'));
  if (!token) return reply(401, { error: 'Sign in again, then try deleting your account.' });
  if (!adminConfigured()) return reply(503, { error: 'Account deletion is not available right now. Please try again later.' });
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  const { data, error } = await admin().auth.getUser(token); // validates the token with Supabase; the user id comes from it, never from the request body
  if (error || !data.user) return reply(401, { error: 'Your session has ended. Sign in again, then try deleting your account.' });
  const user = data.user;
  const verdict = checkDeleteRequest({
    confirm: typeof body.confirm === 'string' ? body.confirm : '',
    adminReady: true,
    hasVerifiedFactor: hasVerifiedFactor(user.factors),
    aal: tokenAal(token),
    signedInAt: sessionSignInAt(token),
    now: Date.now(),
  });
  if (!verdict.ok) return reply(verdict.status, { error: verdict.error });
  const failed = await deleteViaRpc(admin(), user.id, (e) => logErr('native.deleteAccount.db', e)); // database function from migration 0013; the user id is the validated token's, never the request's
  if (failed) {
    logErr('native.deleteAccount', failed);
    return reply(500, { error: failed });
  }
  // tx_trash deliberately has no foreign key (so the undo trigger can run during deletes), so purge this user's trash by hand.
  const { error: trashErr } = await admin().from('tx_trash').delete().eq('user_id', user.id);
  if (trashErr) logErr('native.deleteAccount.trash', trashErr);
  return reply(200, { ok: true });
}
