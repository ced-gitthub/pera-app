import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
import { logErr } from '@/lib/safe';
// Email links land here: password reset (next=/reset) and email confirmation (welcome=1). Accepts the PKCE `code` flow and the `token_hash` flow. Only whitelisted in-app destinations are allowed.
const NEXT = new Set(['/reset', '/']), OTP = new Set(['recovery', 'signup', 'email']);
export async function GET(req: NextRequest) {
  const u = req.nextUrl, code = u.searchParams.get('code'), hash = u.searchParams.get('token_hash'), type = u.searchParams.get('type'), next = NEXT.has(u.searchParams.get('next') ?? '') ? u.searchParams.get('next')! : '/reset';
  const welcome = u.searchParams.get('welcome') === '1' || type === 'signup' || type === 'email', recovery = !welcome && (next === '/reset' || type === 'recovery');
  const to = (path: string, q = '') => { const x = u.clone(); x.pathname = path; x.search = q; return NextResponse.redirect(x); };
  const sb = await supabaseServer(); let error: unknown = code || hash ? null : new Error('missing code');
  if (code) ({ error } = await sb.auth.exchangeCodeForSession(code));
  else if (hash && type && OTP.has(type)) ({ error } = await sb.auth.verifyOtp({ type: type as EmailOtpType, token_hash: hash }));
  else if (hash) error = new Error('unsupported link type');
  if (error) {
    logErr('auth/callback', error);
    return recovery ? to('/forgot', '?err=' + encodeURIComponent('That link is invalid or has expired. Request a new one.')) : to('/verify', '?err=' + encodeURIComponent('That link did not work. If you already confirmed your email, log in. Otherwise enter your email to get a new link.'));
  }
  return welcome ? to('/', '?ok=' + encodeURIComponent('Email confirmed. Welcome to Pera.')) : to(next);
}
