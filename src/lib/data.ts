import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
export type Account = { id: string; name: string; account_type: string; opening_balance_minor: number };
export type Category = { id: string; name: string; type: 'income' | 'expense' };
// soft=true (server actions called from client code): throw a readable error instead of redirecting.
export async function ctx(soft = false) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { if (soft) throw new Error('Session expired. Please sign in again.'); redirect('/login'); }
  const [a, c] = await Promise.all([sb.from('accounts').select('id,name,account_type,opening_balance_minor').order('name'), sb.from('categories').select('id,name,type').order('name')]);
  if (a.error || c.error) throw new Error((a.error ?? c.error)!.message);
  return { sb, user, accounts: a.data as Account[], categories: c.data as Category[] };
}
