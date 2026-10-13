import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { sendCodeError } from './logic';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Same behaviour as the website's /code page: never reveals whether an address has an account.
// With create set, this is sign-up: the account is made when the code is confirmed, and the name is kept on the profile.
export async function sendCode(email: string, create?: { name: string }): Promise<string | null> {
  if (!isEmail(email)) return 'Enter a valid email address.';
  if (create && !create.name.trim()) return 'Type your name so we can greet you.';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: create ? { shouldCreateUser: true, data: { name: create.name.trim().slice(0, 40) } } : { shouldCreateUser: false },
  });
  return sendCodeError(error, !!create);
}

export async function verifyCode(email: string, token: string): Promise<string | null> {
  if (!/^\d{6,10}$/.test(token)) return 'Enter the code from the email (numbers only).';
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  return error ? 'That code is wrong or has expired. Request a new one.' : null;
}

// Google through Supabase (PKCE). The redirect zovix://auth/callback must be in Supabase's redirect URL list.
export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return 'Could not start Google sign-in.';
  const r = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (r.type !== 'success') return null; // cancelled
  const code = new URL(r.url).searchParams.get('code');
  if (!code) return 'Google sign-in did not finish. Try again.';
  const { error: e2 } = await supabase.auth.exchangeCodeForSession(code);
  return e2 ? 'Google sign-in did not finish. Try again.' : null;
}

// Two-step (TOTP) users: the database refuses their data until the session is aal2.
// Refreshes the user from the server first (factors may have been added on the website). Throws when it cannot tell, so the app never shows empty data.
export async function needsTotp() {
  const u = await supabase.auth.getUser();
  if (u.error) throw u.error;
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) throw error ?? new Error('aal');
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

// Cold start: Android may kill the app while the browser is open; finish the exchange only for the exact callback URL.
export async function handleLink(url: string | null) {
  if (!url || !url.startsWith('zovix://auth/callback')) return;
  const code = new URL(url).searchParams.get('code');
  if (code) await supabase.auth.exchangeCodeForSession(code);
}
export async function verifyTotp(code: string): Promise<string | null> {
  const { data: f } = await supabase.auth.mfa.listFactors();
  const factor = f?.totp?.find((t) => t.status === 'verified');
  if (!factor) return 'No authenticator found.';
  const { data: ch, error } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (error || !ch) return 'Could not start verification.';
  const { error: e2 } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code: code.trim() });
  return e2 ? 'That code is wrong. Try the current one.' : null;
}
