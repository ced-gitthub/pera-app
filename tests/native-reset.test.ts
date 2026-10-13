import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RESET_KINDS, resetWarning, confirmPhrase, canConfirm, resetError } from '../native/src/resetLogic.ts';
import { countRows, resetWith, RESET_TABLES } from '../native/src/resetCore.ts';
import { fakeDb4 } from './helpers/fakeDb4.ts';

test('reset kinds are entries, budgets and goals, each mapped to its table', () => {
  assert.deepEqual([...RESET_KINDS], ['entries', 'budgets', 'goals']);
  assert.deepEqual(RESET_TABLES, { entries: 'transactions', budgets: 'budgets', goals: 'savings_goals' });
});

test('countRows asks for a head count of the right table', async () => {
  const { db, log } = fakeDb4({ counts: { transactions: 123, budgets: 4, savings_goals: 2 } });
  assert.equal(await countRows(db, 'entries'), 123);
  assert.equal(await countRows(db, 'budgets'), 4);
  assert.equal(await countRows(db, 'goals'), 2);
  assert.deepEqual(
    log.counts.map((x) => x.table),
    ['transactions', 'budgets', 'savings_goals'],
  );
  assert.deepEqual(log.counts[0].opts, { count: 'exact', head: true });
});

test('countRows returns null (unknown) when the count fails', async () => {
  const { db } = fakeDb4({ failCount: true });
  assert.equal(await countRows(db, 'entries'), null);
});

test('resetWith deletes every row of that table (id is not null) and returns null', async () => {
  const { db, log, counts } = fakeDb4({ counts: { transactions: 5, budgets: 3 } });
  assert.equal(await resetWith(db, 'entries'), null);
  assert.deepEqual(log.deletes, [{ table: 'transactions', col: 'id', op: 'is', value: null }]);
  assert.equal(counts.transactions, 0);
  assert.equal(counts.budgets, 3, 'other tables untouched');
  assert.equal(await resetWith(db, 'goals'), null);
  assert.equal(log.deletes[1].table, 'savings_goals');
  assert.equal(await resetWith(db, 'budgets'), null);
  assert.equal(log.deletes[2].table, 'budgets');
});

test('a failed delete returns a friendly message and never raw database text', async () => {
  const { db } = fakeDb4({ failDelete: true });
  const msg = await resetWith(db, 'entries');
  assert.ok(msg && msg.length > 10);
  assert.doesNotMatch(msg, /permission denied|transactions|raw|42501/i);
  assert.match(msg, /nothing was deleted|try again/i);
});

test('an unknown kind is refused without touching the database', async () => {
  const { db, log } = fakeDb4();
  const msg = await resetWith(db, 'accounts' as never);
  assert.ok(msg);
  assert.equal(log.deletes.length, 0);
});

test('resetError is friendly for network, expired session, two-step and unknown errors', () => {
  const all = [
    resetError(null),
    resetError({ message: 'Failed to fetch' }),
    resetError({ message: 'JWT expired', code: 'PGRST301' }),
    resetError({ message: 'new row violates row-level security policy', code: '42501' }),
    resetError({ message: 'canceling statement due to statement timeout', code: '57014' }),
    resetError('weird'),
  ];
  assert.match(all[1], /connection/i);
  assert.match(all[2], /sign in/i);
  for (const m of all.slice(1)) {
    assert.ok(m.length > 10);
    assert.doesNotMatch(m, /JWT|PGRST|policy|statement|42501|57014|fetch/i);
  }
});

test('the typed word is DELETE, matched ignoring case and surrounding spaces', () => {
  for (const k of RESET_KINDS) {
    assert.equal(confirmPhrase(k), 'DELETE');
    assert.equal(canConfirm('DELETE', k), true);
    assert.equal(canConfirm('  delete ', k), true);
    assert.equal(canConfirm('Delete', k), true);
    assert.equal(canConfirm('', k), false);
    assert.equal(canConfirm('DELET', k), false);
    assert.equal(canConfirm('DELETE ALL', k), false);
    assert.equal(canConfirm('yes', k), false);
  }
});

test('the warning says what is deleted, what stays, and uses plain counts', () => {
  const e = resetWarning('entries', 123);
  assert.match(e, /Deletes all 123 entries/);
  assert.match(e, /accounts, categories, budgets and goals stay/i);
  assert.match(e, /starting balances/i);
  assert.match(e, /30 days/);
  assert.match(e, /cannot restore a whole batch/i);
  assert.match(resetWarning('entries', 1), /Deletes the 1 entry/);
  const b = resetWarning('budgets', 4);
  assert.match(b, /all 4 budgets/i);
  assert.match(b, /entries, accounts, categories and goals stay/i);
  const g = resetWarning('goals', 2);
  assert.match(g, /all 2 savings goals/i);
  assert.match(g, /entries, accounts, categories and budgets stay/i);
  for (const k of RESET_KINDS) assert.match(resetWarning(k, 3), /cannot be undone|cannot restore|can't be undone/i);
});

test('the reset UI has labelled controls and uses a danger button', () => {
  const src = fs.readFileSync('native/src/ResetData.tsx', 'utf8');
  assert.match(src, /accessibilityLabel/);
  assert.match(src, /danger/);
  assert.match(src, /canConfirm/);
  assert.ok(src.split('\n').length < 400);
});
