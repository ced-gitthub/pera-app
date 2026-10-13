import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuleWith, setRuleActiveWith, deleteRuleWith, runDueWith } from '../native/src/recurringCore.ts';
import { MAX_RULES, type RuleRow } from '../native/src/recurringLogic.ts';
import { makeFakeDb } from './helpers/fakeDb2.ts';

const row: RuleRow = {
  id: '11111111-1111-4111-8111-111111111111',
  account_id: 'a',
  category_id: 'f',
  type: 'expense',
  amount_minor: 1500000,
  description: 'Rent',
  frequency: 'monthly',
  interval_count: 1,
  start_date: '2026-01-15',
  next_run_date: '2026-01-15',
  end_date: null,
  active: false,
};
const seedRule = { ...row, run_count: 2 };
const TABLE = 'recurring_transactions';
const dbErr = 'new row violates row-level security policy for table "recurring_transactions"';

test('createRule: duplicate id (23505) means already saved: null, inserted once', async () => {
  const { db, tables, calls } = makeFakeDb();
  assert.equal(await createRuleWith(db, 'u1', row), null);
  assert.equal(await createRuleWith(db, 'u1', row), null); // retry / double tap
  assert.equal(tables[TABLE].length, 1);
  assert.equal(tables[TABLE][0].user_id, 'u1');
  assert.equal(calls.filter((c) => c.op === 'insert').length, 2);
});

test('createRule: PRLIM maps to the 100-rule message, never raw text', async () => {
  const { db } = makeFakeDb({}, { errorFor: () => ({ message: 'PRLIM: too many rows', code: 'PRLIM' }) });
  const msg = await createRuleWith(db, 'u1', row);
  assert.match(msg ?? '', new RegExp(`at most ${MAX_RULES} recurring rules`));
});

test('createRule: other errors are generic', async () => {
  const { db } = makeFakeDb({}, { errorFor: () => ({ message: dbErr, code: '42501' }) });
  const msg = await createRuleWith(db, 'u1', row);
  assert.ok(msg && !msg.includes('row-level') && !msg.includes('recurring_transactions'));
});

test('resume writes active, run_count and next_run_date in ONE update (no backfill)', async () => {
  const { db, tables, calls } = makeFakeDb({ [TABLE]: [seedRule] });
  assert.equal(await setRuleActiveWith(db, { id: row.id }, true, '2026-10-14'), null);
  const updates = calls.filter((c) => c.op === 'update');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].payload, { active: true, run_count: 9, next_run_date: '2026-10-15' });
  assert.deepEqual(updates[0].filters, [['id', row.id]]);
  assert.equal(tables[TABLE][0].run_count, 9);
});

test('resume after the end date leaves the rule inactive', async () => {
  const { db, calls } = makeFakeDb({ [TABLE]: [{ ...seedRule, end_date: '2026-06-30' }] });
  assert.equal(await setRuleActiveWith(db, { id: row.id }, true, '2026-10-14'), null);
  assert.equal(calls.find((c) => c.op === 'update')?.payload?.active, false);
});

test('pause only sets active=false and never touches run_count', async () => {
  const { db, tables, calls } = makeFakeDb({ [TABLE]: [{ ...seedRule, active: true }] });
  assert.equal(await setRuleActiveWith(db, { id: row.id }, false, '2026-10-14'), null);
  const updates = calls.filter((c) => c.op === 'update');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].payload, { active: false });
  assert.equal(tables[TABLE][0].run_count, 2);
  assert.equal(calls.filter((c) => c.op === 'select').length, 0);
});

test('resume: a failed load or update returns a clear message', async () => {
  const a = makeFakeDb({}); // rule not found
  const m1 = await setRuleActiveWith(a.db, { id: 'nope' }, true, '2026-10-14');
  assert.match(m1 ?? '', /Could not change that rule/);
  const b = makeFakeDb({ [TABLE]: [seedRule] }, { errorFor: (c) => (c.op === 'update' ? { message: dbErr } : null) });
  const m2 = await setRuleActiveWith(b.db, { id: row.id }, true, '2026-10-14');
  assert.match(m2 ?? '', /Could not change that rule/);
  assert.ok(!m2?.includes('row-level'));
});

test('delete removes the rule; a failure is a clear message', async () => {
  const { db, tables } = makeFakeDb({ [TABLE]: [seedRule] });
  assert.equal(await deleteRuleWith(db, row.id), null);
  assert.equal(tables[TABLE].length, 0);
  const bad = makeFakeDb({ [TABLE]: [seedRule] }, { errorFor: () => ({ message: dbErr }) });
  const msg = await deleteRuleWith(bad.db, row.id);
  assert.match(msg ?? '', /Could not delete that rule/);
});

test('runDue: calls run_recurring with the given date and returns the count', async () => {
  const { db, rpcCalls } = makeFakeDb({}, { rpc: () => ({ data: 3, error: null }) });
  assert.deepEqual(await runDueWith(db, '2026-10-14', '2026-10-14'), { created: 3, error: null });
  assert.deepEqual(rpcCalls, [{ fn: 'run_recurring', args: { p_today: '2026-10-14' } }]);
});

test('runDue: never sends a date more than 1 day past the device date', async () => {
  const { db, rpcCalls } = makeFakeDb();
  await runDueWith(db, '2027-05-01', '2026-10-14');
  assert.equal(rpcCalls[0].args.p_today, '2026-10-15');
  await runDueWith(db, '2026-10-14', '2026-10-14'); // server behind device is fine
  assert.equal(rpcCalls[1].args.p_today, '2026-10-14');
});

test('runDue: a bad date does not run at all', async () => {
  const { db, rpcCalls } = makeFakeDb();
  const r = await runDueWith(db, 'not-a-date', '2026-10-14');
  assert.equal(r.created, 0);
  assert.ok(r.error);
  assert.equal(rpcCalls.length, 0);
});

test('runDue: a database error gives a clear message, never raw DB text', async () => {
  const { db } = makeFakeDb({}, { rpc: () => ({ data: null, error: { message: 'relation "transactions" violates foo', code: 'XX000' } }) });
  const r = await runDueWith(db, '2026-10-14', '2026-10-14');
  assert.equal(r.created, 0);
  assert.match(r.error ?? '', /Could not run your recurring rules/);
  assert.ok(!/relation|violates/.test(r.error ?? ''));
});
