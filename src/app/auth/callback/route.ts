import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { logErr } from '@/lib/safe';
// Email links (password reset) land here. Accepts the PKCE `code` flow and the `token_hash` flow. Only whitelisted in-app destinations are allowed.
const NEXT = new Set(['/reset', '/']);
export async function GET(req: NextRequest) {
  const u = req.nextUrl, code = u.searchParams.get('code'), hash = u.searchParams.get('token_hash'), type = u.searchParams.get('type'), next = NEXT.has(u.searchParams.get('next') ?? '') ? u.searchParams.get('next')! : '/reset';
  const to = (path: string, q = '') => { const x = u.clone(); x.pathname = path; x.search = q; return NextResponse.redirect(x); };
  const sb = await supabaseServer(); let error: unknown = code || hash ? null : new Error('missing code');
  if (code) ({ error } = await sb.auth.exchangeCodeForSession(code));
  else if (hash && type === 'recovery') ({ error } = await sb.auth.verifyOtp({ type: 'recovery', token_hash: hash }));
  else if (hash) error = new Error('unsupported link type');
  if (error) { logErr('auth/callback', error); return to('/forgot', '?err=' + encodeURIComponent('That link is invalid or has expired. Request a new one.')); }
  return to(next);
}
