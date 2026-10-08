import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function updateSession(request: NextRequest) {
  if (/^\/api\/(health|qa)(\/|$)/.test(request.nextUrl.pathname)) return NextResponse.next(); // diagnostics are public/token-gated, no session needed
  let res = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (cs: { name: string; value: string; options: any }[]) => {
      cs.forEach(({ name, value }) => request.cookies.set(name, value)); res = NextResponse.next({ request }); cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } },
  });
  const { data: { user } } = await sb.auth.getUser(); // validates + refreshes the session
  const isAuthPage = ['/login', '/register'].some(p => request.nextUrl.pathname.startsWith(p));
  const to = (path: string) => { const u = request.nextUrl.clone(); u.pathname = path; u.search = ''; return NextResponse.redirect(u); };
  if (!user && !isAuthPage) return to('/login');
  if (user && isAuthPage) return to('/');
  return res;
}
