import { supabase } from './supabase';
import { manageError, type AccountType, type AccountValue, type CategoryValue } from './manageLogic';

// Writes behind Manage accounts and categories. Every one returns null on success or a plain message. RLS limits all of them to the owner;
// the database also enforces unique names and the row caps, and refuses a delete while entries still use the row (foreign key 23503).
const SESSION = 'Session expired. Please sign in again.';

export type AccountRow = {
  id: string;
  name: string;
  account_type: AccountType;
  short_name: string | null;
  opening_balance_minor: number;
};

// Snapshot.accounts has no account_type, so the editor reads what it needs itself.
export async function loadAccountRows(): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id,name,account_type,short_name,opening_balance_minor')
    .order('sort_order')
    .order('name');
  if (error) throw new Error('Could not load your accounts. Check your connection.');
  return (data ?? []).map((a) => ({ ...a, opening_balance_minor: Number(a.opening_balance_minor) })) as AccountRow[];
}

export async function addAccount(v: AccountValue): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return SESSION;
  const { data: last, error: e1 } = await supabase.from('accounts').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  if (e1) return manageError(e1, 'account', 'save');
  const next = Number(last?.[0]?.sort_order ?? 0) + 10;
  const { error } = await supabase.from('accounts').insert({ user_id: u.user.id, ...v, sort_order: next });
  return manageError(error, 'account', 'save') || null;
}

export async function updateAccount(id: string, v: AccountValue): Promise<string | null> {
  const { error } = await supabase.from('accounts').update(v).eq('id', id);
  return manageError(error, 'account', 'save') || null;
}

export async function deleteAccount(id: string): Promise<string | null> {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  return manageError(error, 'account', 'delete') || null;
}

// A new category goes just before "Other" / "Other Income" so that one stays last (same as the website).
export async function addCategory(v: CategoryValue): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return SESSION;
  const { data: list, error: e1 } = await supabase.from('categories').select('id,name,sort_order').eq('type', v.type).order('sort_order');
  if (e1) return manageError(e1, 'category', 'save');
  const rows = list ?? [],
    other = rows.find((c) => c.name === (v.type === 'income' ? 'Other Income' : 'Other')),
    max = Math.max(0, ...rows.map((c) => Number(c.sort_order)));
  const { error } = await supabase
    .from('categories')
    .insert({ user_id: u.user.id, name: v.name, type: v.type, sort_order: other ? Number(other.sort_order) : max + 10 });
  if (error) return manageError(error, 'category', 'save');
  if (other)
    await supabase
      .from('categories')
      .update({ sort_order: Number(other.sort_order) + 10 })
      .eq('id', other.id);
  return null;
}

export async function renameCategory(id: string, name: string): Promise<string | null> {
  const { error } = await supabase.from('categories').update({ name }).eq('id', id);
  return manageError(error, 'category', 'save') || null;
}

export async function deleteCategory(id: string): Promise<string | null> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  return manageError(error, 'category', 'delete') || null;
}
