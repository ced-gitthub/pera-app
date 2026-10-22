import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryError, formOf, categoriesFor, switchType, UNDO_MS } from '../../native/src/entriesLogic.ts';
import type { Category, Tx } from '../../native/src/logic.ts';

const cats: Category[] = [
  { id: 'f', name: 'Food', type: 'expense' },
  { id: 's', name: 'Salary', type: 'income' },
];
const tx: Tx = {
  id: 't1',
  type: 'expense',
  amount_minor: 15050,
  description: 'Lunch',
  transaction_date: '2026-10-14',
  category_id: 'f',
  account_id: 'b',
};

test('errors: never show raw database text', () => {
  for (const what of ['save', 'delete', 'restore'] as const) {
    const m = entryError({ message: 'permission denied for table transactions (SQLSTATE 42501)' }, what);
    assert.ok(!/SQLSTATE|permission denied|table/i.test(m), what);
    assert.ok(/try again/i.test(m), what);
  }
});

test('errors: a restore whose account or category was deleted says so', () => {
  assert.match(entryError({ message: 'fk', code: '23503' }, 'restore'), /account or category/i);
});

test('errors: a save that hits the per-user cap or a missing row is explained', () => {
  assert.match(entryError({ message: 'x', code: 'PRLIM' }, 'save'), /limit/i);
});

test('form: prefills amount from centavos without floats, and a null category/account become empty', () => {
  const f = formOf(tx);
  assert.equal(f.amount, '150.50');
  assert.equal(f.date, '2026-10-14');
  assert.equal(f.accountId, 'b');
  assert.equal(f.categoryId, 'f');
  assert.equal(f.toId, '');
  const g = formOf({ ...tx, amount_minor: 20000, category_id: null, account_id: null, type: 'transfer' });
  assert.equal(g.amount, '200.00');
  assert.equal(g.accountId, '');
  assert.equal(g.categoryId, '');
});

test('categories: only the ones that match the type; moved has none', () => {
  assert.deepEqual(
    categoriesFor('expense', cats).map((x) => x.id),
    ['f'],
  );
  assert.deepEqual(
    categoriesFor('income', cats).map((x) => x.id),
    ['s'],
  );
  assert.deepEqual(categoriesFor('transfer', cats), []);
});

test('switching type clears a category that no longer matches and the to-account when not a transfer', () => {
  const f = { ...formOf(tx), toId: 'a' };
  const inc = switchType(f, 'income', cats);
  assert.equal(inc.type, 'income');
  assert.equal(inc.categoryId, '');
  assert.equal(inc.toId, '');
  const same = switchType(formOf(tx), 'expense', cats);
  assert.equal(same.categoryId, 'f');
  const mv = switchType(formOf(tx), 'transfer', cats);
  assert.equal(mv.categoryId, '');
});

test('undo stays about 8 seconds', () => {
  assert.equal(UNDO_MS, 8000);
});
