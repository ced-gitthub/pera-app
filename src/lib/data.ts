import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import { UserError, dbError, logErr } from './safe';
import { normalizeLayout } from './layout';
export type Account = { id: string; name: string; account_type: string; opening_balance_minor: number; short_name: string | null; counts_as_savings: boolean; show_on_home: boolean; sort_order: number };
export type Category = { id: string; name: string; type: 'income' | 'expense'; sort_order: number };
// soft=true (server actions called from client code): throw a readable error instead of redirecting.
export async function ctx(soft = false) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { if (soft) throw new UserError('Session expired. Please sign in again.'); redirect('/login'); }
  const [a, c] = await Promise.all([sb.from('accounts').select('id,name,account_type,opening_balance_minor,short_name,counts_as_savings,show_on_home,sort_order').order('sort_order').order('name'), sb.from('categories').select('id,name,type,sort_order').order('sort_order').order('name')]);
  if (a.error || c.error) dbError(a.error ?? c.error, 'ctx');
  return { sb, user, accounts: a.data as Account[], categories: c.data as Category[] };
}
// The signed-in user's layout (see lib/layout.ts). A missing row, a missing table or bad JSON all mean "defaults": a layout problem never takes a page down.
export async function loadLayout(sb: Awaited<ReturnType<typeof supabaseServer>>, userId: string) {
  const { data, error } = await sb.from('user_settings').select('layout').eq('user_id', userId).maybeSingle();
  if (error) logErr('loadLayout', error);
  return normalizeLayout(data?.layout);
}
export const aliasMap = (accounts: Account[]) => Object.fromEntries(accounts.filter(a => a.short_name).map(a => [a.short_name!.toLowerCase(), a.name]));
// account id -> current balance (opening + income - expenses - transfers out + transfers in), computed in the database.
export async function balanceMap(sb: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data, error } = await sb.rpc('account_balances'); if (error) dbError(error, 'balances');
  return new Map((data as { account_id: string; balance_minor: number }[]).map(x => [x.account_id, Number(x.balance_minor)]));
}
