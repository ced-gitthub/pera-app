import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftMonth, monthLabel, monthBounds, summarize, yearSeries, barHeights, canGoNext } from '../native/src/reportsLogic.ts';

const cats = [
  { id: 'f', name: 'Food', type: 'expense' as const },
  { id: 't', name: 'Transport', type: 'expense' as const },
  { id: 's', name: 'Salary', type: 'income' as const },
];

test('month navigation crosses year boundaries both ways', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-10', 0), '2026-10');
  assert.equal(shiftMonth('2026-03', -15), '2024-12');
  assert.equal(shiftMonth('2026-03', 25), '2028-04');
});

test('month label and bounds (leap year, 30/31 day months)', () => {
  assert.equal(monthLabel('2026-10'), 'October 2026');
  assert.equal(monthLabel('2026-01'), 'January 2026');
  assert.deepEqual(monthBounds('2024-02'), { from: '2024-02-01', to: '2024-02-29', year: 2024 });
  assert.deepEqual(monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28', year: 2026 });
  assert.deepEqual(monthBounds('2026-11'), { from: '2026-11-01', to: '2026-11-30', year: 2026 });
  assert.deepEqual(monthBounds('2026-12'), { from: '2026-12-01', to: '2026-12-31', year: 2026 });
});

test('next is blocked after the current Manila month', () => {
  assert.equal(canGoNext('2026-10', '2026-10-14'), true); // can step to next month (one month ahead is the limit, for planned entries)
  assert.equal(canGoNext('2026-11', '2026-10-14'), false);
});

test('summarize: totals, net, transfers excluded, bigint strings accepted', () => {
  const r = summarize(
    [
      { type: 'income', category_id: 's', total_minor: '5000000', n: 1 },
      { type: 'expense', category_id: 'f', total_minor: 120000, n: 4 },
      { type: 'expense', category_id: 't', total_minor: 30000, n: 2 },
      { type: 'transfer', category_id: null, total_minor: 999999, n: 3 },
    ],
    cats,
  );
  assert.equal(r.income, 5000000);
  assert.equal(r.expense, 150000);
  assert.equal(r.net, 4850000);
  assert.equal(r.count, 7);
  assert.deepEqual(
    r.byCategory.map((x) => x.name),
    ['Food', 'Transport'],
  );
});

test('summarize: categories sort largest first, ties by name, same category merges, unknown becomes Other', () => {
  const r = summarize(
    [
      { type: 'expense', category_id: 't', total_minor: 100, n: 1 },
      { type: 'expense', category_id: 'f', total_minor: 100, n: 1 },
      { type: 'expense', category_id: 'f', total_minor: 50, n: 1 },
      { type: 'expense', category_id: null, total_minor: 400, n: 1 },
      { type: 'expense', category_id: 'gone', total_minor: 25, n: 1 },
    ],
    cats,
  );
  assert.deepEqual(
    r.byCategory.map((x) => [x.name, x.total]),
    [
      ['Other', 425],
      ['Food', 150],
      ['Transport', 100],
    ],
  );
});

test('summarize: percentages are integers, never above 100, and handle zero', () => {
  const r = summarize(
    [
      { type: 'expense', category_id: 'f', total_minor: 1, n: 1 },
      { type: 'expense', category_id: 't', total_minor: 2, n: 1 },
    ],
    cats,
  );
  assert.deepEqual(
    r.byCategory.map((x) => x.pct),
    [67, 33],
  );
  const one = summarize([{ type: 'expense', category_id: 'f', total_minor: 99_999_999_999, n: 1 }], cats);
  assert.equal(one.byCategory[0].pct, 100);
  const empty = summarize([], cats);
  assert.deepEqual(empty, { income: 0, expense: 0, net: 0, count: 0, byCategory: [] });
  const zero = summarize([{ type: 'expense', category_id: 'f', total_minor: 0, n: 0 }], cats);
  assert.equal(zero.byCategory[0].pct, 0);
  for (const x of r.byCategory) assert.ok(Number.isInteger(x.pct) && x.pct <= 100);
});

test('summarize: bad numbers never produce NaN and a loss shows a negative net', () => {
  const r = summarize(
    [
      { type: 'income', category_id: 's', total_minor: 'abc', n: 1 },
      { type: 'expense', category_id: 'f', total_minor: 700, n: 1 },
    ],
    cats,
  );
  assert.equal(r.income, 0);
  assert.equal(r.net, -700);
});

test('yearSeries: always 12 entries, zeros for missing months, strings accepted, junk ignored', () => {
  const s = yearSeries([
    { month: 3, income_minor: '1000', expense_minor: 400 },
    { month: 12, income_minor: 0, expense_minor: 50 },
    { month: 13, income_minor: 9, expense_minor: 9 },
    { month: 0, income_minor: 9, expense_minor: 9 },
  ]);
  assert.equal(s.length, 12);
  assert.deepEqual(
    s.map((x) => x.month),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.deepEqual(s[2], { month: 3, income: 1000, expense: 400 });
  assert.deepEqual(s[0], { month: 1, income: 0, expense: 0 });
  assert.deepEqual(s[11], { month: 12, income: 0, expense: 50 });
  assert.equal(yearSeries([]).length, 12);
});

test('barHeights: scaled to the biggest value, integers 0..100, empty year is all zero', () => {
  const s = yearSeries([
    { month: 1, income_minor: 1000, expense_minor: 250 },
    { month: 2, income_minor: 0, expense_minor: 500 },
  ]);
  const h = barHeights(s);
  assert.deepEqual(h[0], { income: 100, expense: 25 });
  assert.deepEqual(h[1], { income: 0, expense: 50 });
  assert.deepEqual(h[5], { income: 0, expense: 0 });
  assert.deepEqual(barHeights(yearSeries([]))[0], { income: 0, expense: 0 });
  for (const x of h) assert.ok(x.income <= 100 && x.expense <= 100);
});
