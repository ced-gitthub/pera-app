import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeDb } from './helpers/fakeDb.ts';
import { createEntryWith } from '../native/src/entriesCore.ts';
import { blankForm } from '../native/src/entriesLogic.ts';
import { planTxEdit, type Snapshot } from '../native/src/logic.ts';

const src = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');
const patch = {
  amount_minor: 15050,
  transaction_date: '2026-10-14',
  description: 'Lunch',
  account_id: 'a',
  type: 'expense' as const,
  category_id: 'c',
  transfer_account_id: null,
};
const RAW = /SQLSTATE|permission denied|violates|relation|constraint|network down|JWT/i;

// manual create
test('create: inserts one row with user, request id and index 0, then re-counts', async () => {
  const db = fakeDb({ 'transactions.select': { count: 1 } });
  assert.equal(await createEntryWith(db, 'u1', patch, 'req1'), null);
  const ups = db.of('transactions', 'upsert');
  assert.equal(ups.length, 1);
  assert.deepEqual(ups[0].args[0], { ...patch, user_id: 'u1', request_id: 'req1', request_idx: 0 });
  assert.deepEqual(ups[0].args[1], { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true });
  assert.deepEqual(db.of('transactions', 'select')[0].filters, [['request_id', 'req1']]);
});
test('create: a double submit with the same request id still counts one row', async () => {
  const db = fakeDb({ 'transactions.select': { count: 1 } });
  assert.equal(await createEntryWith(db, 'u1', patch, 'req1'), null);
  assert.equal(await createEntryWith(db, 'u1', patch, 'req1'), null);
  for (const u of db.of('transactions', 'upsert')) assert.equal((u.args[0] as { request_id: string }).request_id, 'req1');
});
test('create: failures give a friendly message, never raw text', async () => {
  for (const set of [
    { 'transactions.upsert': { error: { message: 'permission denied SQLSTATE 42501', code: '42501' } } },
    { 'transactions.upsert': 'throw' as const },
    { 'transactions.select': { count: 0 } },
  ]) {
    const m = await createEntryWith(fakeDb(set), 'u1', patch, 'r');
    assert.ok(m && /not saved/i.test(m));
    assert.doesNotMatch(m, RAW);
  }
});
test('create: the row limit gives the clear limit message', async () => {
  const m = await createEntryWith(fakeDb({ 'transactions.upsert': { error: { message: 'PRLIM', code: 'PRLIM' } } }), 'u1', patch, 'r');
  assert.match(m ?? '', /limit/i);
});
test('create: blank form is a spent entry today on the first account with no category; planTxEdit validates', () => {
  const snap = { accounts: [{ id: 'a' }, { id: 'b' }], categories: [{ id: 'c', name: 'Food', type: 'expense' }] } as unknown as Snapshot;
  const f = blankForm(snap, '2026-10-14');
  assert.deepEqual(f, { type: 'expense', amount: '', date: '2026-10-14', description: '', accountId: 'a', toId: '', categoryId: '' });
  assert.equal(planTxEdit(f, snap, '2026-10-14').ok, false); // no amount
  assert.equal(planTxEdit({ ...f, amount: '12.50' }, snap, '2026-10-14').ok, false); // no category
  assert.equal(planTxEdit({ ...f, amount: '12.50', categoryId: 'c' }, snap, '2026-10-14').ok, true);
  assert.equal(planTxEdit({ ...f, amount: '12.50', date: '1999-01-01' }, snap, '2026-10-14').ok, false);
});

// pinned close controls
test('Sheet: Done is in an always-visible header and the content scroll area shrinks', () => {
  const s = src('Sheet.tsx');
  assert.match(s, /<HeaderClose onPress=\{onClose\}/);
  assert.match(s, /label = 'Done'/);
  assert.match(s, /<ScrollView style=\{\{ flexShrink: 1 \}\}/);
  assert.match(s, /maxHeight: '85%'/);
  assert.match(s, /Math\.max\(bottom, sp\.xl\)/);
  assert.match(s, /minHeight: 48/);
  assert.doesNotMatch(s, /<Btn label="Done"/);
});
test('Manage: the full-screen page has a Close in its pinned header and no bottom-only close', () => {
  const s = src('Manage.tsx');
  assert.match(s, /<HeaderClose label="Close" onPress=\{onClose\}/);
  assert.doesNotMatch(s, /<Btn label="Done"/);
  assert.ok(s.indexOf('<HeaderClose') < s.indexOf('<ScrollView'));
});
test('no Settings sheet has its own bottom-only close', () => {
  for (const f of ['Reports.tsx', 'Csv.tsx', 'Recurring.tsx', 'ResetData.tsx', 'Settings.tsx'])
    assert.doesNotMatch(src(f), /label="(Done|Close)"/, f);
});

// one primary action per tab
test('every tab uses the Fab for its primary action', () => {
  assert.match(src('Home.tsx'), /<Fab label="＋ Add"/);
  assert.match(src('Tabs.tsx'), /fab=\{\{ label: '＋ Add entry'/);
  assert.match(src('AccountsTab.tsx'), /label: '＋ Add account'/);
  const p = src('Planning.tsx');
  assert.match(p, /label: '＋ New budget'/);
  assert.match(p, /label: '＋ New goal'/);
  assert.doesNotMatch(p, /gearLabel="New (budget|goal)"/);
  assert.match(src('Tabs.tsx'), /bottom \+ sp\.clear/);
  assert.match(src('Fab.tsx'), /position: 'absolute'/);
});
test('Accounts: no "You owe" group; Debt included card and owed tag', () => {
  const s = src('AccountsTab.tsx');
  assert.doesNotMatch(s, /You owe|'owed'\s*,\s*title/);
  assert.match(s, /Debt included/);
  assert.match(s, /Already subtracted from Spendable/);
  assert.match(s, />owed</);
  assert.match(src('Home.tsx'), /Spendable already counts/);
});
