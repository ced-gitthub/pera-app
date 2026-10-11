import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { isEmail } from '@/lib/password';
import { ctx } from '@/lib/data';

export function go(path: string, k: 'err' | 'ok', m: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(m.slice(0, 200))}`);
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

export const done = () => revalidatePath('/', 'layout');

// ---- auth
// Origin used inside emailed links. A pinned value wins over request headers, so a forged Host header can never point a reset link at another site.
export const siteUrl = async () => {
  const h = await headers(),
    pinned =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return (pinned || h.get('origin') || `https://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'}`).replace(/\/$/, '');
};

export const verifyUrl = (email: string) => '/verify' + (isEmail(email) ? `?email=${encodeURIComponent(email)}` : '');

export const errCode = (e: unknown) => (e as { code?: string } | null)?.code ?? '';

export const code6 = (fd: FormData) => str(fd, 'code').replace(/\s/g, '');

export async function authed() {
  const sb = await supabaseServer(),
    {
      data: { user },
    } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return { sb, user };
}

export async function needsSecondStep(sb: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export type Sb0 = Awaited<ReturnType<typeof ctx>>['sb'];

// A new category goes just before "Other" (so "Other" stays last). Used for the fee categories that appear the first time you use them, and for categories you add.
export async function addCategory(sb: Sb0, userId: string, name: string, type: 'income' | 'expense') {
  const { data: list } = await sb.from('categories').select('id,name,sort_order').eq('type', type).order('sort_order').order('name');
  const last = (list ?? []).find((c) => c.name === (type === 'income' ? 'Other Income' : 'Other')),
    max = Math.max(0, ...(list ?? []).map((c) => Number(c.sort_order)));
  const r = await sb
    .from('categories')
    .insert({ user_id: userId, name, type, sort_order: last ? Number(last.sort_order) : max + 10 })
    .select('id,name,type,sort_order')
    .single();
  if (!r.error && last)
    await sb
      .from('categories')
      .update({ sort_order: Number(last.sort_order) + 10 })
      .eq('id', last.id);
  return r;
}

export type Sb = Awaited<ReturnType<typeof ctx>>['sb'];

// Swap an item with its neighbour. Orders are renumbered 10, 20, 30... first so ties (older rows) can never stall a move.
export async function swapOrder(
  sb: Sb0,
  table: 'accounts' | 'categories',
  rows: { id: string; sort_order: number }[],
  id: string,
  dir: string,
) {
  const i = rows.findIndex((r) => r.id === id),
    j = i + (dir === 'up' ? -1 : 1);
  if (i < 0 || j < 0 || j >= rows.length) return null;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  for (const [k, r] of next.entries())
    if (Number(r.sort_order) !== (k + 1) * 10) {
      const { error } = await sb
        .from(table)
        .update({ sort_order: (k + 1) * 10 })
        .eq('id', r.id);
      if (error) return error;
    }
  return null;
}
