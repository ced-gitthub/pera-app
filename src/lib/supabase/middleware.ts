import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function updateSession(request: NextRequest) {
  if (/^\/api\/health(\/|$)/.test(request.nextUrl.pathname)) return NextResponse.next(); // public health check, no session needed
  let res = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (cs: { name: string; value: string; options: any }[]) => {
      cs.forEach(({ name, value }) => request.cookies.set(name, value)); res = NextResponse.next({ request }); cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } },
  });
  const { data: { user } } = await sb.auth.getUser(); // validates + refreshes the session
  const path = request.nextUrl.pathname, isAuthPage = ['/login', '/register'].some(p => path.startsWith(p)), isPublic = isAuthPage || ['/forgot', '/auth/'].some(p => path.startsWith(p));
  const to = (path: string) => { const u = request.nextUrl.clone(); u.pathname = path; u.search = ''; return NextResponse.redirect(u); };
  if (!user && !isPublic) { if (path.startsWith('/reset')) { const u = request.nextUrl.clone(); u.pathname = '/forgot'; u.search = '?err=' + encodeURIComponent('That link is invalid or has expired. Request a new one.'); return NextResponse.redirect(u); } return to('/login'); }
  if (user && isAuthPage) return to('/');
  return res;
}
