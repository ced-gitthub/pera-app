// Integration tests against a REAL Supabase project (needs .env.local + migrations 0001 and 0002 applied + "Confirm email" OFF). Not run by the author.
import test from 'node:test'; import assert from 'node:assert/strict'; import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, run = Date.now();
const client = () => createClient(url, key, { auth: { persistSession: false } });
async function user(tag) { const c = client(), email = `pera-${tag}-${run}@example.com`; const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' }); assert.ifError(error); assert.ok(data.session, 'disable "Confirm email" for tests'); return { c, id: data.user.id }; }
let A, B, aAcct, aCat, aTx;
test('setup: two users, default categories/accounts seeded', async () => {
  A = await user('a'); B = await user('b');
  const { data: accts } = await A.c.from('accounts').select('id,name'); assert.equal(accts.length, 6); aAcct = accts.find(x => x.name === 'Cash').id;
  const { data: cats } = await A.c.from('categories').select('id,name,type'); assert.equal(cats.length, 20); aCat = cats.find(x => x.name === 'Food').id;
  const { data, error } = await A.c.from('transactions').insert({ user_id: A.id, account_id: aAcct, category_id: aCat, type: 'expense', amount_minor: 12050, transaction_date: '2026-10-05' }).select('id'); assert.ifError(error); aTx = data[0].id;
});
test('RLS: B cannot read, update, delete or insert as A', async () => {
  for (const t of ['transactions', 'accounts', 'categories', 'budgets', 'recurring_transactions', 'profiles']) { const { data } = await B.c.from(t).select('*').eq(t === 'profiles' ? 'id' : 'user_id', A.id); assert.equal(data?.length ?? 0, 0, t + ' leaked'); }
  const u = await B.c.from('transactions').update({ amount_minor: 1 }).eq('id', aTx).select('id'); assert.equal(u.data?.length ?? 0, 0);
  const d = await B.c.from('transactions').delete().eq('id', aTx).select('id'); assert.equal(d.data?.length ?? 0, 0);
  assert.ok((await B.c.from('transactions').insert({ user_id: A.id, account_id: aAcct, category_id: aCat, type: 'expense', amount_minor: 1, transaction_date: '2026-10-05' })).error, 'insert as A must fail');
  const { data: bAccts } = await B.c.from('accounts').select('id').limit(1);
  assert.ok((await B.c.from('transactions').insert({ user_id: B.id, account_id: aAcct, category_id: aCat, type: 'expense', amount_minor: 1, transaction_date: '2026-10-05' })).error, "B must not link A's account/category");
  assert.ok(bAccts.length === 1); assert.equal((await client().from('transactions').select('id')).data?.length ?? 0, 0, 'anonymous read');
  assert.equal((await A.c.from('transactions').select('amount_minor').eq('id', aTx).single()).data.amount_minor, 12050);
});
test('constraints: amounts, transfers, idempotent request ids', async () => {
  const row = { user_id: A.id, account_id: aAcct, category_id: aCat, type: 'expense', transaction_date: '2026-10-05' };
  for (const amount_minor of [0, -5, 1e12]) assert.ok((await A.c.from('transactions').insert({ ...row, amount_minor })).error, 'amount ' + amount_minor);
  assert.ok((await A.c.from('transactions').insert({ ...row, type: 'transfer', amount_minor: 5, category_id: null, transfer_account_id: aAcct })).error, 'transfer to same account');
  const rid = crypto.randomUUID(), rows = [0, 1].map(i => ({ ...row, amount_minor: 100 + i, request_id: rid, request_idx: i }));
  for (let i = 0; i < 3; i++) assert.ifError((await A.c.from('transactions').upsert(rows, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true })).error);
  assert.equal((await A.c.from('transactions').select('id', { count: 'exact', head: true }).eq('request_id', rid)).count, 2, 'retries must not duplicate');
});
test('balances: transfer moves money, totals unchanged', async () => {
  const { data: accts } = await A.c.from('accounts').select('id,name'), g = accts.find(x => x.name === 'GCash').id;
  await A.c.from('accounts').update({ opening_balance_minor: 1000000 }).eq('id', g); const total = async () => (await A.c.rpc('account_balances')).data.reduce((n, x) => n + Number(x.balance_minor), 0), before = await total();
  assert.ifError((await A.c.from('transactions').insert({ user_id: A.id, type: 'transfer', amount_minor: 200000, account_id: g, transfer_account_id: aAcct, transaction_date: '2026-10-05' })).error);
  assert.equal(await total(), before); const bal = Object.fromEntries((await A.c.rpc('account_balances')).data.map(x => [x.account_id, Number(x.balance_minor)])); assert.equal(bal[g], 800000);
  const s = (await A.c.rpc('period_summary', { p_from: '2026-10-01', p_to: '2026-10-31' })).data; assert.ok(s.every(x => x.type !== 'transfer'), 'transfers are not income/expense');
});
test('recurring: 31st monthly clamps without drift, re-run adds nothing', async () => {
  const { data: cats } = await A.c.from('categories').select('id,name'), sub = cats.find(x => x.name === 'Subscriptions').id;
  const { data, error } = await A.c.from('recurring_transactions').insert({ user_id: A.id, account_id: aAcct, category_id: sub, type: 'expense', amount_minor: 54900, description: 'Netflix', frequency: 'monthly', start_date: '2026-01-31', next_run_date: '2026-01-31' }).select('id'); assert.ifError(error);
  assert.equal((await A.c.rpc('run_recurring', { p_today: '2026-04-30' })).data, 4); assert.equal((await A.c.rpc('run_recurring', { p_today: '2026-04-30' })).data, 0);
  const { data: tx } = await A.c.from('transactions').select('transaction_date').eq('recurring_id', data[0].id).order('transaction_date'); assert.deepEqual(tx.map(x => x.transaction_date), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});
