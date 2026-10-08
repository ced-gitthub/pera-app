import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// Server-only client using the PUBLISHABLE key + the user's session cookie: every query runs as the user, so RLS is the security boundary.
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: (cs: { name: string; value: string; options: any }[]) => { try { cs.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* called from a Server Component: middleware refreshes the session */ } } },
  });
}
