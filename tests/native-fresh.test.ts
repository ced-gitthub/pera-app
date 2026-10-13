import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldCleanNewAccount, JUST_SIGNED_UP_KEY } from '../native/src/freshLogic.ts';
import { cleanNewAccountWith, type FreshDb } from '../native/src/freshCore.ts';

const NOW = Date.parse('2026-10-14T10:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

test('clean start: only right after an in-app sign-up, and only for a brand-new account', () => {
  assert.equal(shouldCleanNewAccount(true, minutesAgo(3), NOW), true);
  assert.equal(shouldCleanNewAccount(false, minutesAgo(3), NOW), false); // signed in, not signed up: never touch data
  assert.equal(shouldCleanNewAccount(true, minutesAgo(60 * 25), NOW), false); // an account older than a day is never wiped
  assert.equal(shouldCleanNewAccount(true, undefined, NOW), false); // unknown age: do nothing
  assert.equal(shouldCleanNewAccount(true, 'not a date', NOW), false);
  assert.equal(JUST_SIGNED_UP_KEY, 'zv_just_signed_up');
});

type Call = { table: string; op: string; arg?: unknown };
function recorder(failTable = ''): { db: FreshDb; calls: Call[] } {
  const calls: Call[] = [];
  const db: FreshDb = {
    from(table: string) {
      return {
        select: () => Promise.resolve({ count: 0, error: null }),
        delete: () => ({
          not: (col: string) => {
            calls.push({ table, op: 'delete', arg: col });
            return Promise.resolve({ count: 1, error: failTable === table ? { message: 'permission denied (raw)', code: '42501' } : null });
          },
        }),
        update: (v: { opening_balance_minor: number }) => ({
          neq: (col: string, val: number) => {
            calls.push({ table, op: 'update', arg: { v, col, val } });
            return Promise.resolve({ error: failTable === table ? { message: 'raw db text' } : null });
          },
        }),
      };
    },
  };
  return { db, calls };
}

test('clean start removes entries, budgets and goals and zeroes opening balances, nothing else', async () => {
  const { db, calls } = recorder();
  assert.equal(await cleanNewAccountWith(db), null);
  assert.deepEqual(
    calls.map((c) => `${c.op}:${c.table}`),
    ['delete:transactions', 'delete:budgets', 'delete:savings_goals', 'update:accounts'],
  );
  assert.deepEqual(calls[3].arg, { v: { opening_balance_minor: 0 }, col: 'opening_balance_minor', val: 0 });
});

test('clean start stops at the first failure with a friendly message and never shows raw database text', async () => {
  const { db, calls } = recorder('budgets');
  const m = await cleanNewAccountWith(db);
  assert.ok(m && !/raw|permission denied/.test(m));
  assert.equal(
    calls.some((c) => c.table === 'savings_goals'),
    false,
  ); // stopped before the later steps
});
