import { supabase } from './supabase';
import { validateItems } from '../../src/lib/validate';
import type { Item } from '../../src/core/parser';
import { missingFeeCategories, type Account, type Category, type Tx, type Snapshot } from './logic';

export { preview, newRequestId, type Snapshot, type Preview } from './logic';

export async function load(): Promise<Snapshot> {
  const [a, c, b, t] = await Promise.all([
    supabase.from('accounts').select('id,name,short_name,counts_as_savings').order('sort_order').order('name'),
    supabase.from('categories').select('id,name,type').order('sort_order').order('name'),
    supabase.rpc('account_balances'),
    supabase
      .from('transactions')
      .select('id,type,amount_minor,description,transaction_date,category_id,account_id')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  const err = a.error ?? c.error ?? b.error ?? t.error;
  if (err) throw new Error('Could not load your data. Check your connection.');
  const balances: Record<string, number> = {};
  for (const x of (b.data ?? []) as { account_id: string; balance_minor: number }[]) balances[x.account_id] = Number(x.balance_minor);
  return { accounts: a.data as Account[], categories: c.data as Category[], balances, recent: t.data as unknown as Tx[] };
}

// Retry-safe: the same requestId can be sent twice and saves once (unique user_id+request_id+request_idx).
export async function save(requestId: string, items: Item[], s: Snapshot): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'Session expired. Please sign in again.';
  // Fee categories (Transfer Fee, ATM Fee, ...) are created on first use, exactly as on the website.
  let categories = s.categories;
  const missing = missingFeeCategories(items, categories);
  if (missing.length) {
    const { data: all } = await supabase.from('categories').select('sort_order');
    const max = Math.max(0, ...(all ?? []).map((x) => Number(x.sort_order)));
    const { error } = await supabase
      .from('categories')
      .insert(missing.map((name, i) => ({ user_id: u.user!.id, name, type: 'expense', sort_order: max + 10 * (i + 1) })));
    if (error && (error as { code?: string }).code !== '23505') return 'Not saved: could not create the fee category. Try again.';
    const { data } = await supabase.from('categories').select('id,name,type').order('sort_order').order('name');
    if (data) categories = data as Category[];
  }
  const v = validateItems(items, { categories, accounts: s.accounts });
  if (!v.ok) return 'Not saved: ' + v.error;
  const rows = v.rows.map((r, i) => ({ ...r, user_id: u.user!.id, request_id: requestId, request_idx: i }));
  const { error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true });
  if (error) return 'Not saved: ' + (/PRLIM/.test(error.message) ? 'you reached the storage limit.' : 'the server refused it. Try again.');
  const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('request_id', requestId);
  return count === rows.length ? null : 'Not saved: the database did not confirm the write.';
}
