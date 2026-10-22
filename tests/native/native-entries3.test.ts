import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb } from '../helpers/fakeDb.ts';
import { deleteEntryWith, restoreEntryWith, updateEntryWith, GONE } from '../../native/src/entriesCore.ts';
import { afterRestore, ALREADY_BACK, entryError } from '../../native/src/entriesLogic.ts';

const row = {
  id: 'tx1',
  amount_minor: 15050,
  type: 'expense',
  transaction_date: '2026-10-14',
  description: 'Lunch',
  account_id: 'a',
  category_id: 'c',
  recurring_id: 'r1',
};
const RAW = /SQLSTATE|permission denied|violates|relation|constraint|network down|JWT/i;
const okRestore = () => ({
  'recurring_transactions.select': { data: { id: 'r1' }, error: null },
  'transactions.upsert': { data: null, error: null },
  'transactions.select': { data: null, error: null, count: 1 },
  'tx_trash.delete': { data: null, error: null },
});

// afterRestore: what the Undo bar shows after a restore attempt
test('afterRestore: success clears the bar', () => {
  assert.equal(afterRestore({ row }, null), null);
});
test('afterRestore: failure keeps the row (so Undo can retry) and shows the message', () => {
  const next = afterRestore({ row }, 'Could not bring it back: try again.');
  assert.deepEqual(next, { row, error: 'Could not bring it back: try again.' });
});
test('afterRestore: a second failure replaces the first message and still keeps the row', () => {
  const next = afterRestore({ row, error: 'old' }, 'new');
  assert.deepEqual(next, { row, error: 'new' });
});
test('afterRestore: "already back" counts as success', () => {
  assert.equal(afterRestore({ row }, ALREADY_BACK), null);
});
test('errors: a unique conflict on restore means it is already back; other ops keep the generic text', () => {
  assert.equal(entryError({ message: 'dup', code: '23505' }, 'restore'), ALREADY_BACK);
  assert.match(ALREADY_BACK, /already back/i);
  assert.doesNotMatch(entryError({ message: 'dup', code: '23505' }, 'save'), /already back/i);
});

// restore
test('restore: a failed upsert returns a message and keeps the trash copy', async () => {
  const db = fakeDb({
    ...okRestore(),
    'transactions.upsert': { error: { message: 'permission denied SQLSTATE 42501', code: '42501' } },
  });
  const m = await restoreEntryWith(db, 'u1', row);
  assert.ok(m && /try again/i.test(m));
  assert.doesNotMatch(m, RAW);
  assert.equal(db.of('tx_trash', 'delete').length, 0);
});

test('restore: a network failure returns a message and keeps the trash copy', async () => {
  const db = fakeDb({ ...okRestore(), 'transactions.upsert': 'throw' });
  const m = await restoreEntryWith(db, 'u1', row);
  assert.ok(m);
  assert.doesNotMatch(m, RAW);
  assert.equal(db.of('tx_trash', 'delete').length, 0);
});

test('restore: a unique conflict returns the "already back" message and keeps the trash copy', async () => {
  const db = fakeDb({
    ...okRestore(),
    'transactions.upsert': { error: { message: 'duplicate key import_hash', code: '23505' } },
  });
  assert.equal(await restoreEntryWith(db, 'u1', row), ALREADY_BACK);
  assert.equal(db.of('tx_trash', 'delete').length, 0);
});

test('restore: success deletes the trash copy only AFTER the count check', async () => {
  const db = fakeDb(okRestore());
  assert.equal(await restoreEntryWith(db, 'u1', row), null);
  const count = db.of('transactions', 'select')[0];
  const trash = db.of('tx_trash', 'delete');
  assert.equal(trash.length, 1);
  assert.deepEqual(trash[0].filters, [['tx_id', 'tx1']]);
  assert.ok(count && trash[0].n > count.n);
  assert.ok(count.n > db.of('transactions', 'upsert')[0].n);
});

test('restore: count !== 1 is an error and keeps the trash copy', async () => {
  for (const c of [0, 2, null]) {
    const db = fakeDb({ ...okRestore(), 'transactions.select': { count: c, error: null } });
    const m = await restoreEntryWith(db, 'u1', row);
    assert.ok(m, `count ${c}`);
    assert.doesNotMatch(m, RAW);
    assert.equal(db.of('tx_trash', 'delete').length, 0, `count ${c}`);
  }
});

test('restore: a failed count query is an error and keeps the trash copy', async () => {
  const db = fakeDb({ ...okRestore(), 'transactions.select': { count: null, error: { message: 'JWT expired' } } });
  const m = await restoreEntryWith(db, 'u1', row);
  assert.ok(m);
  assert.doesNotMatch(m, RAW);
  assert.equal(db.of('tx_trash', 'delete').length, 0);
});

test('restore: a failing trash cleanup does not undo a successful restore', async () => {
  const db = fakeDb({ ...okRestore(), 'tx_trash.delete': 'throw' });
  assert.equal(await restoreEntryWith(db, 'u1', row), null);
});

test('restore: recurring_id is dropped when the rule no longer exists, kept when it does', async () => {
  const gone = fakeDb({ ...okRestore(), 'recurring_transactions.select': { data: null, error: null } });
  assert.equal(await restoreEntryWith(gone, 'u1', row), null);
  const sent = gone.of('transactions', 'upsert')[0].args[0] as Record<string, unknown>;
  assert.equal('recurring_id' in sent, false);
  assert.equal(sent.id, 'tx1');
  assert.equal(sent.user_id, 'u1');

  const there = fakeDb(okRestore());
  await restoreEntryWith(there, 'u1', row);
  assert.equal((there.of('transactions', 'upsert')[0].args[0] as Record<string, unknown>).recurring_id, 'r1');
});

test('restore: no recurring lookup when the row has no rule', async () => {
  const { recurring_id: _drop, ...plain } = row;
  const db = fakeDb(okRestore());
  assert.equal(await restoreEntryWith(db, 'u1', plain), null);
  assert.equal(db.calls.filter((c) => c.table === 'recurring_transactions').length, 0);
});

test('restore: twice is one idempotent row (single object upsert on id, ignoreDuplicates)', async () => {
  const db = fakeDb(okRestore());
  assert.equal(await restoreEntryWith(db, 'u1', row), null);
  assert.equal(await restoreEntryWith(db, 'u1', row), null);
  const ups = db.of('transactions', 'upsert');
  assert.equal(ups.length, 2);
  for (const u of ups) {
    assert.ok(!Array.isArray(u.args[0]));
    assert.equal((u.args[0] as Record<string, unknown>).id, 'tx1');
    assert.deepEqual(u.args[1], { onConflict: 'id', ignoreDuplicates: true });
  }
  assert.deepEqual(ups[0].args, ups[1].args);
});

test('restore: a row without an id is refused without touching the database', async () => {
  const db = fakeDb(okRestore());
  const m = await restoreEntryWith(db, 'u1', { amount_minor: 5 });
  assert.ok(m);
  assert.equal(db.calls.length, 0);
});

// delete
test('delete: returns the deleted row', async () => {
  const db = fakeDb({ 'transactions.delete': { data: [row], error: null } });
  const res = await deleteEntryWith(db, 'tx1');
  assert.deepEqual(res, { row });
  const call = db.of('transactions', 'delete')[0];
  assert.deepEqual(call.filters, [['id', 'tx1']]);
  assert.deepEqual(call.selected, ['*']);
});

test('delete: a missing row, a refusal and a network failure each give a clear message', async () => {
  const none = await deleteEntryWith(fakeDb({ 'transactions.delete': { data: [], error: null } }), 'x');
  assert.deepEqual(none, { error: GONE });
  const bad = await deleteEntryWith(fakeDb({ 'transactions.delete': { error: { message: 'permission denied SQLSTATE 42501' } } }), 'x');
  assert.ok('error' in bad && !RAW.test(bad.error) && /not deleted/i.test(bad.error));
  const net = await deleteEntryWith(fakeDb({ 'transactions.delete': 'throw' }), 'x');
  assert.ok('error' in net && !RAW.test(net.error));
});

// update
test('update: saved returns null and sends the patch for that id', async () => {
  const db = fakeDb({ 'transactions.update': { data: [{ id: 'tx1' }], error: null } });
  assert.equal(await updateEntryWith(db, 'tx1', { description: 'Dinner' } as never), null);
  const call = db.of('transactions', 'update')[0];
  assert.deepEqual(call.args[0], { description: 'Dinner' });
  assert.deepEqual(call.filters, [['id', 'tx1']]);
});

test('update: a missing row gives a clear message', async () => {
  const m = await updateEntryWith(fakeDb({ 'transactions.update': { data: [], error: null } }), 'x', {} as never);
  assert.equal(m, GONE);
  assert.match(m, /no longer exists/i);
});

test('update: refusals and network failures never show raw database text', async () => {
  const bad = await updateEntryWith(
    fakeDb({ 'transactions.update': { error: { message: 'violates constraint SQLSTATE 23514' } } }),
    'x',
    {} as never,
  );
  assert.ok(bad && !RAW.test(bad) && /not saved/i.test(bad));
  const net = await updateEntryWith(fakeDb({ 'transactions.update': 'throw' }), 'x', {} as never);
  assert.ok(net && !RAW.test(net));
  const cap = await updateEntryWith(fakeDb({ 'transactions.update': { error: { message: 'PRLIM', code: 'PRLIM' } } }), 'x', {} as never);
  assert.match(cap ?? '', /limit/i);
});
