import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrence, resumePlan, manilaDateFromHttpDate, shouldRunDue } from '../native/src/recurringLogic.ts';

const rule = (frequency: string, start_date: string, interval_count = 1, end_date: string | null = null) => ({
  frequency,
  start_date,
  interval_count,
  end_date,
});

test('monthly clamps to the last valid day and never drifts', () => {
  const r = rule('monthly', '2026-01-31');
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((k) => occurrence(r, k)),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'],
  );
  assert.equal(occurrence(rule('monthly', '2028-01-31'), 1), '2028-02-29'); // leap year
  assert.equal(occurrence(rule('monthly', '2026-01-31', 2), 1), '2026-03-31'); // every 2 months
  assert.equal(occurrence(rule('monthly', '2026-11-15'), 2), '2027-01-15'); // year rollover
  assert.equal(occurrence(rule('monthly', '2026-01-31'), 12), '2027-01-31');
});

test('yearly: Feb 29 clamps to Feb 28 in non-leap years', () => {
  const r = rule('yearly', '2024-02-29');
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((k) => occurrence(r, k)),
    ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'],
  );
  assert.equal(occurrence(rule('yearly', '2026-06-10', 2), 3), '2032-06-10');
});

test('daily and weekly maths', () => {
  assert.equal(occurrence(rule('daily', '2026-02-27'), 3), '2026-03-02');
  assert.equal(occurrence(rule('daily', '2026-02-27', 10), 2), '2026-03-19');
  assert.equal(occurrence(rule('weekly', '2026-10-14'), 1), '2026-10-21');
  assert.equal(occurrence(rule('weekly', '2026-12-28', 2), 2), '2027-01-25');
  assert.equal(occurrence(rule('weekly', '2026-10-14'), 0), '2026-10-14');
});

test('occurrence is non-decreasing for every frequency, start and interval', () => {
  const starts = ['2024-02-29', '2026-01-31', '2026-03-30', '2026-12-31', '2027-07-01'];
  for (const f of ['daily', 'weekly', 'monthly', 'yearly'])
    for (const s of starts)
      for (const n of [1, 2, 3, 12, 365]) {
        if (f === 'yearly' && n === 365) continue; // year 16000+: not a real schedule
        let prev = '';
        for (let k = 0; k < 40; k++) {
          const d = occurrence(rule(f, s, n), k);
          assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
          assert.ok(d >= prev, `${f} ${s} x${n} k=${k}: ${d} < ${prev}`);
          prev = d;
        }
      }
});

test('resumePlan skips every date missed while paused', () => {
  const r = rule('monthly', '2026-01-15');
  assert.deepEqual(resumePlan(r, '2026-10-14'), { run_count: 9, next_run_date: '2026-10-15', active: true });
  // today IS an occurrence: it still runs today
  assert.deepEqual(resumePlan(r, '2026-10-15'), { run_count: 9, next_run_date: '2026-10-15', active: true });
  assert.deepEqual(resumePlan(r, '2026-10-16'), { run_count: 10, next_run_date: '2026-11-15', active: true });
});

test('resumePlan for a rule starting in the future is k=0', () => {
  assert.deepEqual(resumePlan(rule('weekly', '2026-11-01'), '2026-10-14'), { run_count: 0, next_run_date: '2026-11-01', active: true });
});

test('resumePlan: clamped month-end rule and daily/yearly', () => {
  assert.deepEqual(resumePlan(rule('monthly', '2026-01-31'), '2026-02-10'), { run_count: 1, next_run_date: '2026-02-28', active: true });
  assert.deepEqual(resumePlan(rule('daily', '2026-10-01', 3), '2026-10-14'), { run_count: 5, next_run_date: '2026-10-16', active: true });
  assert.deepEqual(resumePlan(rule('yearly', '2024-02-29'), '2026-03-01'), { run_count: 3, next_run_date: '2027-02-28', active: true });
});

test('resumePlan honours end_date', () => {
  const r = rule('monthly', '2026-01-15', 1, '2026-06-30');
  assert.deepEqual(resumePlan(r, '2026-10-14'), { run_count: 9, next_run_date: '2026-10-15', active: false }); // resumed after the end: stays off
  assert.deepEqual(resumePlan(r, '2026-05-20'), { run_count: 5, next_run_date: '2026-06-15', active: true });
  assert.equal(resumePlan(rule('monthly', '2026-01-15', 1, '2026-10-15'), '2026-10-14').active, true); // next == end is allowed
});

test('manilaDateFromHttpDate converts to the Manila calendar day', () => {
  assert.equal(manilaDateFromHttpDate('Tue, 14 Oct 2026 02:10:00 GMT'), '2026-10-14');
  assert.equal(manilaDateFromHttpDate('Tue, 14 Oct 2026 16:00:00 GMT'), '2026-10-15'); // 00:00 next day in Manila
  assert.equal(manilaDateFromHttpDate('Tue, 14 Oct 2026 15:59:59 GMT'), '2026-10-14');
  assert.equal(manilaDateFromHttpDate('Thu, 31 Dec 2026 20:00:00 GMT'), '2027-01-01');
});

test('manilaDateFromHttpDate returns null when it cannot parse', () => {
  for (const bad of [
    '',
    'garbage',
    '2026-10-14',
    'Tue, 32 Oct 2026 02:10:00 GMT',
    'Tue, 14 Foo 2026 02:10:00 GMT',
    'Tue, 14 Oct 2026 25:10:00 GMT',
  ])
    assert.equal(manilaDateFromHttpDate(bad), null, bad);
  assert.equal(manilaDateFromHttpDate(null as unknown as string), null);
});

test('shouldRunDue: never run, or the Manila day changed', () => {
  assert.equal(shouldRunDue(null, '2026-10-14'), true);
  assert.equal(shouldRunDue('2026-10-13', '2026-10-14'), true);
  assert.equal(shouldRunDue('2026-10-14', '2026-10-14'), false);
});
