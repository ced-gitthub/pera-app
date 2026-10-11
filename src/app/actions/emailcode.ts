'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { isEmail } from '@/lib/password';
import { authMessage, logErr } from '@/lib/safe';
import { go, str, errCode, code6, needsSecondStep, done } from './shared';

const codeUrl = (email: string) => '/code' + (isEmail(email) ? `?email=${encodeURIComponent(email)}` : '');

// Log in with a one-time code sent by email. Works where Google sign-in cannot (the installed iPhone app keeps its own cookies), and for Google-only accounts. The reply never reveals whether an address has an account.
export async function sendLoginCode(fd: FormData) {
  const email = str(fd, 'email').trim();
  if (!isEmail(email)) go('/code', 'err', 'Enter a valid email address.');
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error && /rate_limit/.test(errCode(error))) go(codeUrl(email), 'err', authMessage(error, 'sendLoginCode'));
  if (error) logErr('sendLoginCode', error);
  go(codeUrl(email), 'ok', 'If an account exists for that email, a login code is on its way. Check your inbox and spam folder.');
}

export async function verifyLoginCode(fd: FormData) {
  const email = str(fd, 'email').trim(),
    token = code6(fd);
  if (!isEmail(email)) go('/code', 'err', 'Enter a valid email address.');
  if (!/^\d{6,10}$/.test(token)) go(codeUrl(email), 'err', 'Enter the code from the email (numbers only).');
  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    logErr('verifyLoginCode', error);
    go(codeUrl(email), 'err', 'That code is wrong or has expired. Request a new one.');
  }
  done(); // a new session: drop every screen the browser remembered for the previous one
  if (await needsSecondStep(sb)) redirect('/2fa');
  redirect('/');
}
