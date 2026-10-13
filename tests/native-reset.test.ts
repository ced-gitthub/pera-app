import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RESET_KINDS, resetWarning, confirmPhrase, canConfirm, resetError, RESET_LABEL, sumCounts } from '../native/src/resetLogic.ts';
import { countRows, resetWith, resetAllWith, countAllWith, RESET_TABLES } from '../native/src/resetCore.ts';
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

test('resetWith deletes every row of that table (id is not null) and returns the real removed count', async () => {
  const { db, log, counts } = fakeDb4({ counts: { transactions: 5, budgets: 3 } });
  assert.deepEqual(await resetWith(db, 'entries'), { error: null, deleted: 5 });
  assert.deepEqual(log.deletes[0], { table: 'transactions', col: 'id', op: 'is', value: null, opts: { count: 'exact' } });
  assert.equal(counts.transactions, 0);
  assert.equal(counts.budgets, 3, 'other tables untouched');
  assert.equal((await resetWith(db, 'goals')).error, null);
  assert.equal(log.deletes[1].table, 'savings_goals');
  assert.equal((await resetWith(db, 'budgets')).error, null);
  assert.equal(log.deletes[2].table, 'budgets');
});

test('resetWith reports what the server removed, not the earlier count', async () => {
  const { db } = fakeDb4({ counts: { transactions: 5 }, removed: 7 });
  assert.deepEqual(await resetWith(db, 'entries'), { error: null, deleted: 7 });
});

test('a failed delete returns a friendly message, no count, and never raw database text', async () => {
  const { db } = fakeDb4({ failDelete: true });
  const { error, deleted } = await resetWith(db, 'entries');
  assert.equal(deleted, null);
  assert.ok(error && error.length > 10);
  assert.doesNotMatch(error, /permission denied|transactions|raw|42501/i);
  assert.match(error, /nothing was deleted|try again/i);
});

test('a thrown network failure is caught and says it could not be confirmed', async () => {
  const { db } = fakeDb4({ throwDelete: new Error('Network request failed') });
  const { error, deleted } = await resetWith(db, 'entries');
  assert.equal(deleted, null);
  assert.match(error ?? '', /could not confirm/i);
});

test('an unknown kind is refused without touching the database', async () => {
  const { db, log } = fakeDb4();
  const { error, deleted } = await resetWith(db, 'accounts' as never);
  assert.ok(error);
  assert.equal(deleted, null);
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
  assert.match(all[1], /could not confirm/i);
  assert.match(all[1], /numbers below/i);
  assert.doesNotMatch(all[1], /nothing was deleted/i);
  assert.match(all[2], /sign in/i);
  for (const m of all.slice(1)) {
    assert.ok(m.length > 10);
    assert.doesNotMatch(m, /JWT|PGRST|policy|canceling|statement timeout|42501|57014|fetch|some items may be gone/i);
  }
});

test('a statement timeout (57014 + "statement timeout") says too many rows, not "try again"', () => {
  const want = /too many rows to delete in one go, so nothing was deleted.*smaller parts/i;
  const m = resetError({ message: 'canceling statement due to statement timeout', code: '57014' });
  assert.match(m, want);
  assert.doesNotMatch(m, /took too long|nothing is half-deleted/i);
  assert.doesNotMatch(m, /57014|canceling|statement timeout/i);
  assert.doesNotMatch(resetError({ message: 'Request timed out' }), want);
  assert.match(resetError({ message: 'Request timed out' }), /could not confirm/i);
});

test('a user-cancelled statement is NOT reported as a timeout', () => {
  const want = /too many rows/i;
  assert.doesNotMatch(resetError({ message: 'canceling statement due to user request', code: '57014' }), want);
  assert.doesNotMatch(resetError({ message: 'canceling statement due to user request' }), want);
});

test('network message points at the numbers once they load', () => {
  assert.equal(resetError({ message: 'Failed to fetch' }), 'Could not confirm that. Check the numbers below once they load.');
});

test('ResetData clears the counts before reloading and shows a could-not-count state', () => {
  const src = fs.readFileSync(new URL('../native/src/ResetData.tsx', import.meta.url), 'utf8');
  const load = src.slice(src.indexOf('const load = useCallback'), src.indexOf('useEffect('));
  assert.ok(load.includes('setCounts(null)') && load.indexOf('setCounts(null)') < load.indexOf('await'), 'load clears counts first');
  assert.match(src, /Could not count right now\. Close and reopen to check\./);
});

test('the unknown-error message is atomic and does not say items may be gone', () => {
  const m = resetError({ message: 'boom' });
  assert.match(m, /either all of them were deleted or none were/i);
  assert.doesNotMatch(m, /some items may be gone/i);
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

test('the warning says what is deleted, what stays, what changes, and uses plain counts', () => {
  const e = resetWarning('entries', 123);
  assert.match(e, /Deletes all 123 entries/);
  assert.match(e, /including real ones|not just (the )?sample/i);
  assert.match(e, /accounts, categories, budgets and goals stay/i);
  assert.match(e, /starting balances/i);
  assert.match(e, /30 days/);
  assert.match(e, /cannot restore a whole batch/i);
  assert.match(e, /streak, XP and level go back to the start/i);
  assert.match(e, /goals that are not linked to an account/i);
  assert.match(e, /recurring rules stay and will keep adding/i);
  assert.match(resetWarning('entries', 1), /Deletes the 1 entry/);
  const b = resetWarning('budgets', 4);
  assert.match(b, /all 4 budgets/i);
  assert.match(b, /including real ones|not just (the )?sample/i);
  assert.match(b, /entries, accounts, categories and goals stay/i);
  assert.match(b, /no longer tracked against a limit/i);
  const g = resetWarning('goals', 2);
  assert.match(g, /all 2 savings goals/i);
  assert.match(g, /including real ones|not just (the )?sample/i);
  assert.match(g, /entries, accounts, categories and budgets stay/i);
  assert.match(g, /no longer see their progress/i);
  for (const k of RESET_KINDS) assert.match(resetWarning(k, 3), /cannot be undone|cannot restore|can't be undone/i);
});

test('the reset UI has labelled controls and uses a danger button', () => {
  const src = fs.readFileSync('native/src/ResetData.tsx', 'utf8');
  assert.match(src, /accessibilityLabel/);
  assert.match(src, /danger/);
  assert.match(src, /canConfirm/);
  assert.ok(src.split('\n').length < 400);
});

test('the reset UI shows the server count and reloads the counts after any error', () => {
  const src = fs.readFileSync('native/src/ResetData.tsx', 'utf8');
  assert.doesNotMatch(src, /Deleted \$\{count\}/);
  assert.match(src, /res\.deleted/);
  const run = src.slice(src.indexOf('async function run'));
  const errBranch = run.slice(run.indexOf('if (res.error)'), run.indexOf('setDone'));
  assert.match(errBranch, /load\(\)/);
});

test('resetAllWith deletes budgets, goals, then entries and sums the removed rows', async () => {
  const { db, log, counts } = fakeDb4({ counts: { transactions: 5, budgets: 3, savings_goals: 2 } });
  assert.deepEqual(await resetAllWith(db), { error: null, deleted: 10, done: ['budgets', 'goals', 'entries'] });
  assert.deepEqual(
    log.deletes.map((d) => d.table),
    ['budgets', 'savings_goals', 'transactions'],
  );
  assert.deepEqual(counts, { transactions: 0, budgets: 0, savings_goals: 0 });
});

test('resetAllWith stops at the first failure and says what was deleted', async () => {
  const { db, log } = fakeDb4({ counts: { transactions: 5, budgets: 3, savings_goals: 2 }, failTables: ['transactions'] });
  const res = await resetAllWith(db);
  assert.deepEqual(res.done, ['budgets', 'goals']);
  assert.equal(res.deleted, null);
  assert.match(res.error ?? '', /^Budgets and goals were deleted, entries were not\. /);
  assert.doesNotMatch(res.error ?? '', /permission denied|transactions|raw|42501/i);
  assert.equal(log.deletes.length, 3);

  const g = fakeDb4({ counts: { budgets: 3 }, failTables: ['savings_goals'] });
  const r2 = await resetAllWith(g.db);
  assert.deepEqual(r2.done, ['budgets']);
  assert.match(r2.error ?? '', /^Budgets were deleted, goals and entries were not\. /);
  assert.equal(g.log.deletes.length, 2, 'entries never attempted');

  const b = fakeDb4({ failTables: ['budgets'] });
  const r3 = await resetAllWith(b.db);
  assert.deepEqual(r3.done, []);
  assert.equal(b.log.deletes.length, 1);
  assert.ok(r3.error && !/were deleted/.test(r3.error));
});

test('resetAllWith treats a thrown failure like an error and still reports progress', async () => {
  const { db } = fakeDb4({ throwDelete: new Error('Network request failed') });
  const res = await resetAllWith(db);
  assert.deepEqual(res.done, []);
  assert.match(res.error ?? '', /could not confirm/i);
});

test('the all warning names every table, what stays, and the side effects', () => {
  const w = resetWarning('all', { entries: 12, budgets: 3, goals: 1 });
  assert.match(w, /12 entries/);
  assert.match(w, /3 budgets/);
  assert.match(w, /1 savings goal/);
  assert.match(w, /real ones/);
  assert.match(w, /login/i);
  assert.match(w, /accounts/i);
  assert.match(w, /categories/i);
  assert.match(w, /recurring rules/i);
  assert.match(w, /starting balances/i);
  assert.match(w, /streak, XP and level/i);
  assert.match(w, /30 days/);
  assert.match(w, /cannot be undone/i);
  assert.match(w, /not the same as deleting your account/i);
});

test('the all choice uses the same DELETE word and a label', () => {
  assert.equal(confirmPhrase('all'), 'DELETE');
  assert.equal(canConfirm(' delete ', 'all'), true);
  assert.equal(canConfirm('del', 'all'), false);
  assert.equal(RESET_LABEL.all, 'Delete ALL my records');
});

test('counts sum to one number, null if any is unknown', async () => {
  assert.equal(sumCounts({ entries: 1, budgets: 2, goals: 3 }), 6);
  assert.equal(sumCounts({ entries: 1, budgets: null, goals: 3 }), null);
  assert.equal(await countAllWith(fakeDb4({ counts: { transactions: 4, budgets: 1, savings_goals: 2 } }).db), 7);
  assert.equal(await countAllWith(fakeDb4({ failCount: true }).db), null);
});

test('ResetData renders the all row first, with a stronger confirm', () => {
  const src = fs.readFileSync('native/src/ResetData.tsx', 'utf8');
  assert.match(src, /\[\s*'all'\s*,\s*\.\.\.RESET_KINDS\s*\]/);
  assert.match(src, /resetChoice/);
  assert.match(src, /sumCounts/);
  assert.match(src, /borderWidth: choice === 'all'/);
});
