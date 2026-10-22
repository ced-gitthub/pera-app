import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resumePlan, occurrence, shouldRunDue } from '../../native/src/recurringLogic.ts';
import { setRuleActiveWith, DATE_UNCONFIRMED } from '../../native/src/recurringCore.ts';
import { makeFakeDb } from '../helpers/fakeDb2.ts';

const TABLE = 'recurring_transactions';
const id = '11111111-1111-4111-8111-111111111111';
const monthly = { id, start_date: '2026-01-15', frequency: 'monthly', interval_count: 1, end_date: null as string | null, run_count: 10 };

test('resume never moves a rule backwards (entries the user deleted must not come back)', () => {
  // run through 2026-10-15 (run_count 10); a phone clock set back to March must not rewind it
  const p = resumePlan({ ...monthly }, '2026-03-01');
  assert.equal(p.run_count, 10);
  assert.equal(p.next_run_date, occurrence(monthly, 10));
});

test('resume still skips the dates missed while paused', () => {
  const p = resumePlan({ ...monthly, run_count: 3 }, '2026-10-14');
  assert.equal(p.run_count, 9);
  assert.equal(p.next_run_date, '2026-10-15');
});

test('resume reads run_count from the database and never lowers it', async () => {
  const { db, calls, tables } = makeFakeDb({ [TABLE]: [{ ...monthly }] });
  assert.equal(await setRuleActiveWith(db, { id }, true, '2026-03-01'), null);
  assert.match(calls.find((c) => c.op === 'select')?.columns ?? '', /run_count/);
  assert.equal(tables[TABLE][0].run_count, 10);
});

test('resume with an unconfirmed date refuses and changes nothing', async () => {
  const { db, calls } = makeFakeDb({ [TABLE]: [{ ...monthly }] });
  assert.equal(await setRuleActiveWith(db, { id }, true, null), DATE_UNCONFIRMED);
  assert.equal(calls.filter((c) => c.op === 'update').length, 0);
});

test('resuming a rule whose end date has passed explains why instead of silently staying paused', async () => {
  const { db, calls } = makeFakeDb({ [TABLE]: [{ ...monthly, run_count: 2, end_date: '2026-06-30' }] });
  const m = await setRuleActiveWith(db, { id }, true, '2026-10-14');
  assert.match(m ?? '', /ended on 2026-06-30/);
  assert.match(m ?? '', /end date|new rule/i);
  assert.equal(calls.filter((c) => c.op === 'update').length, 0);
});

test('pausing needs no date', async () => {
  const { db } = makeFakeDb({ [TABLE]: [{ ...monthly, active: true }] });
  assert.equal(await setRuleActiveWith(db, { id }, false, null), null);
});

test('due rules are not retried for 5 minutes after a failed attempt', () => {
  const now = 1_000_000;
  assert.equal(shouldRunDue(null, '2026-10-14', now - 60_000, now), false); // tried a minute ago
  assert.equal(shouldRunDue(null, '2026-10-14', now - 6 * 60_000, now), true);
  assert.equal(shouldRunDue('2026-10-14', '2026-10-14', null, now), false); // already ran today
  assert.equal(shouldRunDue('2026-10-13', '2026-10-14', null, now), true); // new day
});

test('a failed Undo can always be dismissed', () => {
  const src = fs.readFileSync('native/src/EntrySheet.tsx', 'utf8');
  assert.match(src, /accessibilityLabel="Dismiss"/);
  assert.match(src, /onPress=\{onDismiss\}/);
});
