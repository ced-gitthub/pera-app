import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preview, missingFeeCategories, newRequestId, type Snapshot } from '../native/src/logic.ts';

const snap: Snapshot = {
  accounts: [
    { id: 'a1', name: 'Cash', short_name: null, counts_as_savings: false },
    { id: 'a2', name: 'GCash', short_name: null, counts_as_savings: false },
    { id: 'a3', name: 'BPI', short_name: null, counts_as_savings: false },
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
