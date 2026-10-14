import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb } from './helpers/fakeDb.ts';
import { SAMPLE_IDS, buildSampleRows, canOfferSample } from '../native/src/sampleLogic.ts';
import { addSampleWith, removeSampleWith } from '../native/src/sampleCore.ts';
import { withTimeout } from '../native/src/coachLogic.ts';

const accounts = [
  { id: 'a1', name: 'Cash', short_name: null, counts_as_savings: false, opening_balance_minor: 0, show_on_home: true },
  { id: 'a2', name: 'Savings', short_name: null, counts_as_savings: true, opening_balance_minor: 0, show_on_home: true },
];
const categories = [
  { id: 'c1', name: 'Food', type: 'expense' as const },
  { id: 'c2', name: 'Transport', type: 'expense' as const },
  { id: 'c3', name: 'Salary', type: 'income' as const },
];

test('sample rows: whole centavos, real accounts and categories, recent plausible dates, fixed request ids', () => {
  const rows = buildSampleRows(accounts, categories, '2026-10-14');
  assert.ok(rows.length >= 4 && rows.length <= SAMPLE_IDS.length);
  for (const r of rows) {
    assert.ok(Number.isInteger(r.patch.amount_minor) && r.patch.amount_minor > 0);
    assert.ok(accounts.some((a) => a.id === r.patch.account_id));
    assert.match(r.patch.transaction_date, /^2026-(09|10)-\d\d$/);
    assert.ok(r.patch.transaction_date <= '2026-10-14');
    assert.ok(SAMPLE_IDS.includes(r.requestId));
    assert.match(r.requestId, /^zv-sample-\d+$/);
    assert.match(r.patch.description, /^Sample: /); // it is plain to see that these are samples
    assert.equal(r.patch.type === 'transfer', false);
    if (r.patch.category_id) assert.ok(categories.some((c) => c.id === r.patch.category_id && c.type === r.patch.type));
  }
  assert.equal(new Set(rows.map((r) => r.requestId)).size, rows.length);
});

test('sample rows: needs an account, and works with no categories', () => {
  assert.deepEqual(buildSampleRows([], categories, '2026-10-14'), []);
  const rows = buildSampleRows(accounts, [], '2026-10-14');
  assert.ok(rows.length > 0 && rows.every((r) => r.patch.category_id === null));
});

test('sample data is offered only to an account that has no entries yet', () => {
  assert.equal(canOfferSample({ totalEntries: 0, budgetsCount: 0, goalsCount: 0 }, 2), true);
  assert.equal(canOfferSample({ totalEntries: 1, budgetsCount: 0, goalsCount: 0 }, 2), false);
  assert.equal(canOfferSample({ totalEntries: 0, budgetsCount: 0, goalsCount: 0 }, 0), false);
  assert.equal(canOfferSample(null, 2), false); // unknown: never risk mixing with real data
});

test('adding samples: one retry-safe upsert per row, null when all are confirmed', async () => {
  const rows = buildSampleRows(accounts, categories, '2026-10-14');
  const db = fakeDb({ 'transactions.upsert': { error: null }, 'transactions.select': { count: 1, error: null } });
  assert.equal(await addSampleWith(db, 'u1', rows), null);
  const ups = db.of('transactions', 'upsert');
  assert.equal(ups.length, rows.length);
  for (const u of ups) {
    const row = u.args[0] as Record<string, unknown>;
    assert.equal(row.user_id, 'u1');
    assert.match(String(row.request_id), /^zv-sample-\d+$/);
    assert.deepEqual(u.args[1], { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true });
  }
});

test('adding samples: a refused write is reported, not hidden', async () => {
  const rows = buildSampleRows(accounts, categories, '2026-10-14');
  const db = fakeDb({ 'transactions.upsert': { error: { message: 'PRLIM: limit' } } });
  const msg = await addSampleWith(db, 'u1', rows);
  assert.ok(msg && !/PRLIM/.test(msg));
  assert.ok(await addSampleWith(fakeDb({ 'transactions.upsert': 'throw' }), 'u1', rows));
});

test('removing samples deletes ONLY the fixed sample request ids of this user, never anything else', async () => {
  const db = fakeDb({ 'transactions.delete': { data: [{ id: 'x' }], error: null } });
  assert.equal(await removeSampleWith(db, 'u1'), null);
  const del = db.of('transactions', 'delete');
  assert.equal(del.length, 1);
  assert.deepEqual(del[0].filters, [
    ['user_id', 'u1'],
    ['request_id in', SAMPLE_IDS],
  ]);
  assert.ok(await removeSampleWith(fakeDb({ 'transactions.delete': { error: { message: 'nope' } } }), 'u1'));
  assert.ok(await removeSampleWith(fakeDb({ 'transactions.delete': 'throw' }), 'u1'));
  assert.ok(await removeSampleWith(db, '')); // no user id: refuse, delete nothing more
  assert.equal(db.of('transactions', 'delete').length, 1);
});

test('withTimeout: a promise that never settles still resolves to the fallback', async () => {
  assert.equal(await withTimeout(new Promise<number>(() => {}), 20, -1), -1);
  assert.equal(await withTimeout(Promise.resolve(5), 20, -1), 5);
  assert.equal(await withTimeout(Promise.reject(new Error('x')), 20, -1), -1);
});
