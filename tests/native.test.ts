import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preview, missingFeeCategories, newRequestId, planBalances, planBudget, type Snapshot } from '../native/src/logic.ts';

const snap: Snapshot = {
  accounts: [
    { id: 'a1', name: 'Cash', short_name: null, counts_as_savings: false, opening_balance_minor: 0 },
    { id: 'a2', name: 'GCash', short_name: null, counts_as_savings: false, opening_balance_minor: 0 },
    { id: 'a3', name: 'BPI', short_name: null, counts_as_savings: false, opening_balance_minor: 0 },
  ],
  categories: [{ id: 'c1', name: 'Food', type: 'expense' }],
  balances: { a1: 100000, a2: 100000, a3: 100000 },
  recent: [],
};

test('native preview reuses the website parser: integer centavos, Manila date', () => {
  const p = preview('lunch 150 gcash', snap, '2026-10-13');
  assert.equal(p.problems.length, 0);
  assert.equal(p.items[0].amount_minor, 15000);
  assert.equal(p.items[0].category, 'Food');
  assert.equal(p.items[0].account, 'GCash');
  assert.equal(p.items[0].date, '2026-10-13');
});

test('native preview reports unclear input instead of guessing', () => {
  const p = preview('hello', snap, '2026-10-13');
  assert.equal(p.items.length, 0);
  assert.ok(p.problems.length > 0);
});

test('native fee categories are created only for fixed fee names', () => {
  const items = [
    { type: 'expense', amount_minor: 1500, category: 'Transfer Fee', description: '', date: '2026-10-13', account: 'GCash' },
    { type: 'expense', amount_minor: 100, category: 'Food', description: '', date: '2026-10-13', account: 'Cash' },
    { type: 'expense', amount_minor: 100, category: 'Made Up', description: '', date: '2026-10-13', account: 'Cash' },
  ] as const;
  assert.deepEqual(missingFeeCategories([...items], snap.categories), ['Transfer Fee']);
  const have = [...snap.categories, { id: 'c2', name: 'transfer fee', type: 'expense' as const }];
  assert.deepEqual(missingFeeCategories([...items], have), []);
});

test('native request ids look like uuids and differ per call', () => {
  const a = newRequestId(),
    b = newRequestId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test('wizard balances: opening = typed minus what is already logged, never touches accounts not on the form', () => {
  // GCash shows 1,000.00 now with an opening of 0 (so 1,000.00 of movement is logged); the person says they have 1,500.00 today.
  const r = planBalances({ a2: '1500' }, snap);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.patch, [{ id: 'a2', v: 50000 }]);
});

test('wizard balances: refuses all-empty and bad amounts with a message that says what to fix', () => {
  const none = planBalances({ a1: '', a2: '0' }, snap);
  assert.ok(!none.ok && /at least one account/.test(none.message));
  const bad = planBalances({ a1: '12abc' }, snap);
  assert.ok(!bad.ok && /not a valid amount for Cash/.test(bad.message));
});

test('wizard budget: expense category and a positive limit, stored for the Manila month', () => {
  const ok = planBudget('c1', '3,000', snap, '2026-10-13');
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.row, { category_id: 'c1', amount_minor: 300000, month: 10, year: 2026 });
  assert.ok(!planBudget('nope', '3000', snap).ok);
  assert.ok(!planBudget('c1', '0', snap).ok);
});
