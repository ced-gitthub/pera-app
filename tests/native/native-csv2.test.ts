import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportRowsWith, runImportWith } from '../../native/src/csvCore.ts';
import { BATCH_SIZE, MAX_EXPORT_ROWS, PAGE_SIZE, importMessage, type DbRow, type ImportPlan } from '../../native/src/csvLogic.ts';
import { fakeDb3 } from '../helpers/fakeDb3.ts';

const mk = (n: number, date = '2026-10-10') =>
  Array.from({ length: n }, (_, i) => ({
    type: 'expense',
    amount_minor: 100,
    transaction_date: date,
    description: `r${i}`,
    notes: '',
    category_id: 'f',
    account_id: 'a',
    transfer_account_id: null,
  }));
const dbRow = (i: number): DbRow => ({
  type: 'expense',
  amount_minor: 100 + i,
  account_id: 'a',
  transfer_account_id: null,
  category_id: 'f',
  description: `d${i}`,
  notes: '',
  transaction_date: '2026-10-10',
  import_hash: `h${i}`,
});
const planOf = (n: number, over: Partial<ImportPlan> = {}): ImportPlan => ({
  blocked: null,
  total: n,
  rows: Array.from({ length: n }, (_, i) => dbRow(i)),
  hashes: Array.from({ length: n }, (_, i) => `h${i}`),
  dup: 0,
  problems: [],
  range: { from: '2026-10-10', to: '2026-10-10' },
  ...over,
});
const RAW = /pkey|constraint|23505|raw/;

// ---- export paging
test('export: pages of 1000, stops at the first short page', async () => {
  const f = fakeDb3({ rows: mk(2500) });
  const rows = await exportRowsWith(f.db, {});
  assert.equal(rows.length, 2500);
  assert.deepEqual(f.log.ranges, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test('export: an exactly full last page costs one more empty read, then stops', async () => {
  const f = fakeDb3({ rows: mk(2000) });
  const rows = await exportRowsWith(f.db, {});
  assert.equal(rows.length, 2000);
  assert.equal(f.log.ranges.length, 3);
});

test('export: no entries reads once and returns nothing', async () => {
  const f = fakeDb3({ rows: [] });
  assert.deepEqual(await exportRowsWith(f.db, {}), []);
  assert.equal(f.log.ranges.length, 1);
});

test('export: stops at the cap and never returns more than MAX_EXPORT_ROWS', async () => {
  const f = fakeDb3({ rows: mk(MAX_EXPORT_ROWS + 3000) });
  const rows = await exportRowsWith(f.db, {});
  assert.equal(rows.length, MAX_EXPORT_ROWS);
  assert.equal(f.log.ranges.length, MAX_EXPORT_ROWS / PAGE_SIZE);
});

test('export: the date range is sent to the database as gte/lte', async () => {
  const f = fakeDb3({ rows: [...mk(5, '2026-01-05'), ...mk(7, '2026-03-05')] });
  const rows = await exportRowsWith(f.db, { from: '2026-03-01', to: '2026-03-31' });
  assert.equal(rows.length, 7);
  assert.deepEqual(f.log.filters, ['gte:2026-03-01', 'lte:2026-03-31']);
});

test('export: no range sends no date filters', async () => {
  const f = fakeDb3({ rows: mk(3) });
  await exportRowsWith(f.db, {});
  assert.deepEqual(f.log.filters, []);
});

test('export: a failed page gives a friendly message, never raw database text', async () => {
  const f = fakeDb3({ rows: mk(2500), failPage: 1 });
  await assert.rejects(
    () => exportRowsWith(f.db, {}),
    (e: Error) => /export/i.test(e.message) && !RAW.test(e.message),
  );
});

// ---- import
test('import: batches of 500 with onConflict user_id,import_hash and ignoreDuplicates', async () => {
  const f = fakeDb3();
  const r = await runImportWith(f.db, 'u1', planOf(1200));
  assert.deepEqual(
    f.log.upserts.map((u) => u.size),
    [BATCH_SIZE, BATCH_SIZE, 200],
  );
  assert.deepEqual(f.log.upserts[0].opts, { onConflict: 'user_id,import_hash', ignoreDuplicates: true });
  assert.deepEqual(r, { added: 1200, dup: 0, problems: 0, error: null });
});

test('import: a failure in batch 2 reports batch 1 as added, says Stopped early, and hides raw database text', async () => {
  const f = fakeDb3({ failBatch: 1 });
  const r = await runImportWith(f.db, 'u1', planOf(1200, { dup: 4, problems: [{ row: 9, message: 'x' }] }));
  assert.equal(r.added, BATCH_SIZE);
  assert.equal(f.log.upserts.length, 2, 'does not try batch 3');
  assert.ok(r.error);
  assert.ok(!RAW.test(r.error!));
  assert.equal(r.problems, 1);
  const msg = importMessage(r);
  assert.match(msg, /^Stopped early\./);
  assert.match(msg, /500 added/);
  assert.ok(!RAW.test(msg));
});

test('import: a failure in batch 1 adds nothing', async () => {
  const f = fakeDb3({ failBatch: 0 });
  const r = await runImportWith(f.db, 'u1', planOf(700));
  assert.equal(r.added, 0);
  assert.equal(f.log.upserts.length, 1);
  assert.match(importMessage(r), /Stopped early/);
});

test('import: PRLIM maps to the 50,000 limit message', async () => {
  const f = fakeDb3({ failBatch: 0, failError: { message: 'PRLIM: row limit', code: 'PRLIM' } });
  const r = await runImportWith(f.db, 'u1', planOf(10));
  assert.match(r.error ?? '', /50,000/);
  assert.ok(!/PRLIM/.test(r.error ?? ''));
});

test('import: PRLIM found only in the message text is also mapped', async () => {
  const f = fakeDb3({ failBatch: 1, failError: { message: 'raise exception PRLIM' } });
  const r = await runImportWith(f.db, 'u1', planOf(900));
  assert.match(r.error ?? '', /50,000/);
  assert.equal(r.added, BATCH_SIZE);
});

test('import: running the same plan again inserts nothing new', async () => {
  const f = fakeDb3();
  const plan = planOf(1100);
  const first = await runImportWith(f.db, 'u1', plan);
  assert.equal(first.added, 1100);
  const second = await runImportWith(f.db, 'u1', plan);
  assert.deepEqual(second, { added: 0, dup: 1100, problems: 0, error: null });
  assert.equal(f.existing.size, 1100);
});

test('import: row-count math, added + dup covers every row found minus problems', async () => {
  const f = fakeDb3({ existing: new Set(['h0', 'h5', 'h700']) }); // 3 of 800 already in the table
  const plan = planOf(800, {
    dup: 20,
    problems: [
      { row: 1, message: 'a' },
      { row: 2, message: 'b' },
    ],
  });
  const r = await runImportWith(f.db, 'u1', plan);
  assert.equal(r.added, 797);
  assert.equal(r.dup, 23); // 20 found at Check + 3 skipped by the database
  assert.equal(r.problems, 2);
  assert.equal(r.added + r.dup, 800 + 20);
});

test('import: after a stop, dup counts only rows from batches that ran', async () => {
  const f = fakeDb3({ existing: new Set(['h1', 'h2']), failBatch: 1 });
  const r = await runImportWith(f.db, 'u1', planOf(1000, { dup: 5 }));
  assert.equal(r.added, 498);
  assert.equal(r.dup, 5 + 2);
});

test('import: an empty user id stops before touching the database', async () => {
  const f = fakeDb3();
  const r = await runImportWith(f.db, '', planOf(3));
  assert.equal(r.added, 0);
  assert.equal(f.log.upserts.length, 0);
  assert.ok(r.error);
});
