import { createServerClient } from '@supabase/ssr';
// A throw-away client that never reads or writes the user's cookies. Used only to re-check a password ("current password") without touching the real session.
export const supabaseProbe = () => createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
