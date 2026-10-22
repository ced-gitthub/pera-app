import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTxEdit, restoreRowOf, type Snapshot } from '../../native/src/logic.ts';

const acct = (id: string, name: string) => ({
  id,
  name,
  short_name: null,
  counts_as_savings: false,
  opening_balance_minor: 0,
  show_on_home: true,
});
const snap: Snapshot = {
  accounts: [acct('a', 'Cash'), acct('b', 'GCash')],
  categories: [
    { id: 'f', name: 'Food', type: 'expense' },
    { id: 's', name: 'Salary', type: 'income' },
  ],
  balances: {},
  recent: [],
  dates: [],
  totalEntries: 0,
  noAccount: 0,
};
const base = {
  type: 'expense' as const,
  amount: '150',
  date: '2026-10-14',
  description: 'Lunch',
  accountId: 'b',
  toId: '',
  categoryId: 'f',
};

test('edit: a valid expense becomes a patch in integer centavos', () => {
  const r = planTxEdit(base, snap, '2026-10-14');
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.patch, {
    amount_minor: 15000,
    transaction_date: '2026-10-14',
    description: 'Lunch',
    account_id: 'b',
    type: 'expense',
    category_id: 'f',
    transfer_account_id: null,
  });
});

test('edit: amount must be 0.01 to 999,999,999.99 and says what to fix', () => {
  for (const bad of ['', '0', 'abc', '1.234', '-5', '1000000000']) {
    const r = planTxEdit({ ...base, amount: bad }, snap, '2026-10-14');
    assert.ok(!r.ok && /amount/i.test(r.message), bad);
  }
  assert.equal(planTxEdit({ ...base, amount: '1,250.50' }, snap, '2026-10-14').ok, true);
});

test('edit: the date must be real and plausible (2000 to five years ahead)', () => {
  for (const bad of ['2026-02-30', '1999-12-31', '2040-01-01', 'tomorrow']) {
    const r = planTxEdit({ ...base, date: bad }, snap, '2026-10-14');
    assert.ok(!r.ok && /date/i.test(r.message), bad);
  }
});

test('edit: the category has to match the type, and the account has to be one of yours', () => {
  const wrongCat = planTxEdit({ ...base, categoryId: 's' }, snap, '2026-10-14');
  assert.ok(!wrongCat.ok && /category/i.test(wrongCat.message));
  const wrongAcct = planTxEdit({ ...base, accountId: 'zzz' }, snap, '2026-10-14');
  assert.ok(!wrongAcct.ok && /account/i.test(wrongAcct.message));
});

test('edit: a transfer needs two different accounts and has no category', () => {
  const ok = planTxEdit({ ...base, type: 'transfer', accountId: 'a', toId: 'b', categoryId: '' }, snap, '2026-10-14');
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && [ok.patch.category_id, ok.patch.transfer_account_id], [null, 'b']);
  const same = planTxEdit({ ...base, type: 'transfer', accountId: 'a', toId: 'a' }, snap, '2026-10-14');
  assert.ok(!same.ok && /different/i.test(same.message));
  const none = planTxEdit({ ...base, type: 'transfer', accountId: 'a', toId: '' }, snap, '2026-10-14');
  assert.ok(!none.ok && /to/i.test(none.message));
});

test('edit: the description is cut to 120 characters', () => {
  const r = planTxEdit({ ...base, description: 'x'.repeat(300) }, snap, '2026-10-14');
  assert.ok(r.ok && r.patch.description.length === 120);
});

test('undo: the restore row keeps the original id and fields, drops nulls and unknown columns', () => {
  const deleted = {
    id: 'tx1',
    user_id: 'u',
    account_id: 'a',
    transfer_account_id: null,
    category_id: 'f',
    type: 'expense',
    amount_minor: 15000,
    description: 'Lunch',
    notes: null,
    transaction_date: '2026-10-14',
    secret_extra: 'nope',
    created_at: '2026-10-14T01:00:00Z',
  };
  const r = restoreRowOf(deleted, 'u');
  assert.equal(r.id, 'tx1');
  assert.equal(r.user_id, 'u');
  assert.equal(r.amount_minor, 15000);
  assert.ok(!('transfer_account_id' in r) && !('notes' in r) && !('secret_extra' in r));
});
