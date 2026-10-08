import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
export function middleware(r: NextRequest) { return updateSession(r); }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
