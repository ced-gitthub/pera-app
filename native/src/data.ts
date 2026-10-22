import { supabase } from './supabase';
import { validateItems } from '../../src/lib/common/validate';
import type { Item } from '../../src/core/parser';
import { addDays, manilaToday } from '../../src/core/money';
import { missingFeeCategories, type Account, type Category, type Tx, type Snapshot } from './logic';
import { SAMPLE_IDS, SAMPLE_LABEL, sampleMovementOf } from './sampleLogic';

export { preview, newRequestId, type Snapshot, type Preview } from './logic';

export async function load(): Promise<Snapshot> {
  const since = addDays(manilaToday(), -60);
  const [a, c, b, t, dts, cnt, na, smp] = await Promise.all([
    supabase
      .from('accounts')
      .select('id,name,short_name,counts_as_savings,opening_balance_minor,show_on_home')
      .order('sort_order')
      .order('name'),
    supabase.from('categories').select('id,name,type').order('sort_order').order('name'),
    supabase.rpc('account_balances'),
    supabase
      .from('transactions')
      .select('id,type,amount_minor,description,transaction_date,category_id,account_id')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('transactions')
      .select('transaction_date')
      .gte('transaction_date', since)
      .order('transaction_date', { ascending: false })
      .limit(1000),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
    supabase.rpc('no_account_summary'),
    supabase
      .from('transactions')
      .select('account_id,type,amount_minor')
      .in('request_id', SAMPLE_IDS)
      .like('description', SAMPLE_LABEL + '%'),
  ]);
  const err = a.error ?? c.error ?? b.error ?? t.error ?? dts.error ?? cnt.error ?? na.error ?? smp.error;
  if (err) throw new Error('Could not load your data. Check your connection.');
  const balances: Record<string, number> = {};
  for (const x of (b.data ?? []) as { account_id: string; balance_minor: number }[]) balances[x.account_id] = Number(x.balance_minor);
  return {
    accounts: a.data as Account[],
    categories: c.data as Category[],
    balances,
    recent: t.data as unknown as Tx[],
    dates: (dts.data ?? []).map((x) => x.transaction_date as string),
    totalEntries: cnt.count ?? 0,
    noAccount: Number((na.data as { balance_minor: number }[] | null)?.[0]?.balance_minor ?? 0),
    sampleMovement: sampleMovementOf((smp.data ?? []) as { account_id: string | null; type: string; amount_minor: number }[]),
  };
}

// Retry-safe: the same requestId can be sent twice and saves once (unique user_id+request_id+request_idx).
export async function save(requestId: string, items: Item[], s: Snapshot): Promise<string | null> {
  const { data: u } = await supabase.auth.getSession();
  if (!u.session) return 'Session expired. Please sign in again.';
  // Fee categories (Transfer Fee, ATM Fee, ...) are created on first use, exactly as on the website.
  let categories = s.categories;
  const missing = missingFeeCategories(items, categories);
  if (missing.length) {
    const { data: all } = await supabase.from('categories').select('sort_order');
    const max = Math.max(0, ...(all ?? []).map((x) => Number(x.sort_order)));
    const { error } = await supabase
      .from('categories')
      .insert(missing.map((name, i) => ({ user_id: u.session!.user.id, name, type: 'expense', sort_order: max + 10 * (i + 1) })));
    if (error && (error as { code?: string }).code !== '23505') return 'Not saved: could not create the fee category. Try again.';
    const { data } = await supabase.from('categories').select('id,name,type').order('sort_order').order('name');
    if (data) categories = data as Category[];
  }
  const v = validateItems(items, { categories, accounts: s.accounts });
  if (!v.ok) return 'Not saved: ' + v.error;
  const rows = v.rows.map((r, i) => ({ ...r, user_id: u.session!.user.id, request_id: requestId, request_idx: i }));
  const { error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true });
  if (error) return 'Not saved: ' + (/PRLIM/.test(error.message) ? 'you reached the storage limit.' : 'the server refused it. Try again.');
  const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('request_id', requestId);
  return count === rows.length ? null : 'Not saved: the database did not confirm the write.';
}
