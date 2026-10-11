'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseProbe } from '@/lib/supabase/probe';
import { passwordProblem, isPwned, isEmail, safeNext, PWNED } from '@/lib/password';
import { authMessage, logErr } from '@/lib/safe';
import { admin, adminConfigured } from '@/lib/admin';
import { recentSignIn } from '@/lib/session';
import { go, str, siteUrl, verifyUrl, errCode, code6, authed, needsSecondStep } from './shared';

// Google sign-in: Supabase sends the user to Google, then back to /auth/callback (PKCE). Google has already verified the address, so no confirmation email is needed.
export async function signInWithGoogle() {
  const sb = await supabaseServer();
  let url = '';
  try {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${await siteUrl()}/auth/callback?next=/&oauth=1` },
    });
    if (error) logErr('signInWithGoogle', error);
    else url = data.url ?? '';
  } catch (e) {
    logErr('signInWithGoogle', e);
  }
  if (!url) go('/login', 'err', 'Google sign-in is not available right now. Use your email instead.');
  redirect(url);
}

export async function signIn(fd: FormData) {
  const email = str(fd, 'email').trim(),
    sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password: str(fd, 'password') });
  if (error) {
    if (errCode(error) === 'email_not_confirmed') go(verifyUrl(email), 'err', authMessage(error, 'signIn'));
    go('/login', 'err', authMessage(error, 'signIn'));
  }
  if (await needsSecondStep(sb)) redirect('/2fa');
  redirect('/');
}

export async function signUp(fd: FormData) {
  const email = str(fd, 'email').trim(),
    password = str(fd, 'password');
  if (!isEmail(email)) go('/register', 'err', 'Enter a valid email address.');
  const bad = passwordProblem(password);
  if (bad) go('/register', 'err', bad);
  if (await isPwned(password)) go('/register', 'err', PWNED);
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { name: str(fd, 'name').slice(0, 60) }, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/&welcome=1` },
  });
  if (error) go('/register', 'err', authMessage(error, 'signUp'));
  if (!data.session) redirect(verifyUrl(email));
  redirect('/');
}

// Sends the confirmation link again. The reply never reveals whether an address has an account.
export async function resendVerification(fd: FormData) {
  const email = str(fd, 'email').trim();
  if (!isEmail(email)) go('/verify', 'err', 'Enter a valid email address.');
  const sb = await supabaseServer();
  const { error } = await sb.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback?next=/&welcome=1` },
  });
  if (error && /rate_limit/.test(errCode(error))) go(verifyUrl(email), 'err', authMessage(error, 'resendVerification'));
  if (error) logErr('resendVerification', error);
  go(verifyUrl(email), 'ok', 'If that address is waiting for confirmation, a new link is on its way. Check your inbox and spam folder.');
}

// ---- password recovery (the reply never reveals whether an email has an account)
export async function requestReset(fd: FormData) {
  const email = str(fd, 'email').trim();
  if (!isEmail(email)) go('/forgot', 'err', 'Enter a valid email address.');
  const sb = await supabaseServer();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await siteUrl()}/auth/callback?next=/reset` });
  if (error && /rate_limit/.test(errCode(error))) go('/forgot', 'err', authMessage(error, 'requestReset'));
  if (error) logErr('requestReset', error);
  go('/forgot', 'ok', 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.');
}

export async function updatePassword(fd: FormData) {
  const sb = await supabaseServer(),
    {
      data: { user },
    } = await sb.auth.getUser();
  if (!user) go('/forgot', 'err', 'That link is invalid or has expired. Request a new one.');
  const p = str(fd, 'password'),
    c = str(fd, 'confirm'),
    bad = passwordProblem(p);
  if (bad) go('/reset', 'err', bad);
  if (p !== c) go('/reset', 'err', 'The two passwords do not match.');
  if (await isPwned(p)) go('/reset', 'err', PWNED);
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) go('/reset', 'err', authMessage(error, 'updatePassword'));
  await sb.auth.signOut();
  go('/login', 'ok', 'Password updated. Log in with your new password.');
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect('/login');
}

// ---- security page: change password, log out other devices, two-step verification (authenticator app)
export async function changePassword(fd: FormData) {
  const { sb, user } = await authed(),
    cur = str(fd, 'current'),
    p = str(fd, 'password'),
    c = str(fd, 'confirm'),
    bad = passwordProblem(p);
  if (bad) go('/security', 'err', bad);
  if (p !== c) go('/security', 'err', 'The two new passwords do not match.');
  if (p === cur) go('/security', 'err', 'Choose a password different from your current one.');
  const { error: wrong } = await supabaseProbe().auth.signInWithPassword({ email: user.email ?? '', password: cur });
  if (wrong)
    go(
      '/security',
      'err',
      errCode(wrong) === 'invalid_credentials' || /invalid login/i.test(String((wrong as Error).message))
        ? 'Your current password is not right.'
        : authMessage(wrong, 'changePassword'),
    );
  if (await isPwned(p)) go('/security', 'err', PWNED);
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) go('/security', 'err', authMessage(error, 'changePassword'));
  await sb.auth.signOut({ scope: 'others' });
  go('/security', 'ok', 'Password changed. Every other device was logged out.');
}

export async function signOutOthers() {
  const { sb } = await authed();
  await sb.auth.signOut({ scope: 'others' });
  go('/security', 'ok', 'Every other device was logged out.');
}

export async function signOutEverywhere() {
  const sb = await supabaseServer();
  await sb.auth.signOut({ scope: 'global' });
  go('/login', 'ok', 'Logged out of every device.');
}

// Permanently deletes the signed-in user and, through the database's cascade rules, all of their data (required by Google Play and the App Store).
// Needs the current password and the word DELETE typed in. Nothing is removed unless both are right.
export async function deleteMyAccount(fd: FormData) {
  const { sb, user } = await authed();
  if (await needsSecondStep(sb)) redirect('/2fa'); // a password-only session must never delete an account that has two-step verification
  if (str(fd, 'confirm').trim() !== 'DELETE') go('/security', 'err', 'Type DELETE in capital letters to confirm.');
  if (!adminConfigured()) go('/security', 'err', 'Account deletion is not available right now. Please try again later.');
  if ((user.identities ?? []).some((i) => i.provider === 'email')) {
    const { error: wrong } = await supabaseProbe().auth.signInWithPassword({ email: user.email ?? '', password: str(fd, 'current') });
    if (wrong)
      go(
        '/security',
        'err',
        errCode(wrong) === 'invalid_credentials' || /invalid login/i.test(String((wrong as Error).message))
          ? 'Your current password is not right.'
          : authMessage(wrong, 'deleteMyAccount'),
      );
  } else if (!recentSignIn(user.last_sign_in_at)) {
    // Google-only accounts have no password: require a sign-in within the last 10 minutes instead.
    go('/security', 'err', 'For your safety, log out, sign in with Google again, then delete your account within 10 minutes.');
  }
  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) {
    logErr('deleteMyAccount', error);
    go('/security', 'err', 'We could not delete your account. Nothing was removed. Please try again.');
  }
  // tx_trash deliberately has no foreign key (so the undo trigger can run during deletes), so purge this user's trash by hand.
  const { error: trashErr } = await admin().from('tx_trash').delete().eq('user_id', user.id);
  if (trashErr) logErr('deleteMyAccount.trash', trashErr);
  await sb.auth.signOut();
  go('/login', 'ok', 'Your account and all of its data were permanently deleted.');
}

// Second step after the password. Only reachable with a password session; the middleware blocks everything else until this succeeds.
export async function verifyMfa(fd: FormData) {
  const next = safeNext(str(fd, 'next')),
    back = '/2fa' + (next === '/' ? '' : `?next=${encodeURIComponent(next)}`),
    { sb } = await authed(),
    code = code6(fd);
  if (!/^\d{6}$/.test(code)) go(back, 'err', 'Enter the 6-digit code from your authenticator app.');
  const { data: f } = await sb.auth.mfa.listFactors(),
    factor = f?.totp?.[0];
  if (!factor) redirect(next);
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) go(back, 'err', authMessage(error, 'verifyMfa'));
  redirect(next);
}

type Enroll = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };

export async function mfaStart(): Promise<Enroll> {
  const sb = await supabaseServer(),
    {
      data: { user },
    } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'Session expired. Please sign in again.' };
  const { data: l } = await sb.auth.mfa.listFactors();
  if (l?.totp?.length) return { ok: false, error: 'Two-step verification is already on.' };
  for (const f of l?.all ?? []) if (f.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: f.id }); // drop abandoned setups
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: 'Pera', friendlyName: `Pera ${Date.now()}` });
  if (error || !data) return { ok: false, error: authMessage(error, 'mfaStart') };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function mfaConfirm(factorId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseServer(),
    {
      data: { user },
    } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'Session expired. Please sign in again.' };
  const c = String(code).replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return { ok: false, error: 'Enter the 6-digit code from your authenticator app.' };
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: String(factorId), code: c });
  if (error) return { ok: false, error: authMessage(error, 'mfaConfirm') };
  revalidatePath('/security');
  return { ok: true };
}

export async function disableMfa(fd: FormData) {
  const { sb } = await authed(),
    code = code6(fd);
  if (!/^\d{6}$/.test(code)) go('/security', 'err', 'Enter the 6-digit code from your authenticator app.');
  const { data: f } = await sb.auth.mfa.listFactors(),
    factor = f?.totp?.[0];
  if (!factor) go('/security', 'ok', 'Two-step verification is already off.');
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) go('/security', 'err', authMessage(error, 'disableMfa'));
  const { error: e2 } = await sb.auth.mfa.unenroll({ factorId: factor.id });
  if (e2) go('/security', 'err', authMessage(e2, 'disableMfa'));
  go('/security', 'ok', 'Two-step verification is off.');
}
