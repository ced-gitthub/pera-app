import { createClient } from '@supabase/supabase-js';
// The ONLY place the Supabase secret key is used. Server-only: imported by server actions, never by client components. The key lives in the Vercel env var SUPABASE_SECRET_KEY (never committed, never NEXT_PUBLIC).
export const adminConfigured = () => !!process.env.SUPABASE_SECRET_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
