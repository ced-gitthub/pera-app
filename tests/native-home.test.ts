import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeView, gameView, filterActivity, type Snapshot, type Tx } from '../native/src/logic.ts';
import { startSandbox, runSandbox, sandboxStep, SANDBOX_GOAL_MINOR } from '../native/src/sandbox.ts';

const acct = (id: string, name: string, saving: boolean) => ({
  id,
  name,
  short_name: null,
  counts_as_savings: saving,
  opening_balance_minor: 0,
  show_on_home: true,
});
const snap = (accounts = [acct('a', 'Cash', false), acct('b', 'GCash', false), acct('c', 'Savings', true)]): Snapshot => ({
  accounts,
  categories: [],
  balances: { a: 100000, b: 250000, c: 400000 },
  recent: [],
  dates: [],
  totalEntries: 0,
  noAccount: 0,
});

test('home: spendable is everything except accounts marked as savings (same rule as the website)', () => {
  const v = homeView(snap());
  assert.deepEqual({ spendable: v.spendable, savings: v.savings, total: v.total }, { spendable: 350000, savings: 400000, total: 750000 });
  assert.equal(v.hero, 'spendable');
});

test('home: with no savings account the hero is the Total, never a misleading Spendable', () => {
  const v = homeView(snap([acct('a', 'Cash', false), acct('b', 'GCash', false), acct('c', 'Maya', false)]));
  assert.equal(v.hero, 'total');
  assert.equal(v.savings, 0);
});

test('home: accounts hidden from Home still count in the totals but not in the card list', () => {
  const accounts = [acct('a', 'Cash', false), { ...acct('b', 'GCash', false), show_on_home: false }, acct('c', 'Savings', true)];
  const v = homeView(snap(accounts));
  assert.deepEqual(
    v.cards.map((x) => x.id),
    ['a', 'c'],
  );
  assert.equal(v.total, 750000);
});

test('game: streak, xp and level come from the website rules', () => {
  const g = gameView(['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-01'], 40, '2026-10-14');
  assert.equal(g.streak, 3);
  assert.equal(g.loggedToday, true);
  assert.equal(g.xp, 40 * 5 + 3 * 10);
  assert.equal(g.level.title, 'Peso Pincher'); // 230 XP: Budget Buddy starts at 300
});

test('game: no entries yet means no streak and the first level', () => {
  const g = gameView([], 0, '2026-10-14');
  assert.deepEqual({ s: g.streak, xp: g.xp, l: g.level.level }, { s: 0, xp: 0, l: 1 });
});

const tx = (id: string, type: Tx['type'], account_id: string): Tx => ({
  id,
  type,
  amount_minor: 100,
  description: id,
  transaction_date: '2026-10-14',
  category_id: null,
  account_id,
});
test('activity filter: by type and by account', () => {
  const rows = [tx('1', 'expense', 'a'), tx('2', 'income', 'a'), tx('3', 'expense', 'b'), tx('4', 'transfer', 'b')];
  assert.equal(filterActivity(rows, { type: 'all', accountId: '' }).length, 4);
  assert.deepEqual(
    filterActivity(rows, { type: 'expense', accountId: '' }).map((r) => r.id),
    ['1', '3'],
  );
  assert.deepEqual(
    filterActivity(rows, { type: 'all', accountId: 'b' }).map((r) => r.id),
    ['3', '4'],
  );
});

test('sandbox: a typed expense lowers the right account, in integer centavos', () => {
  const s0 = startSandbox();
  const r = runSandbox(s0, 'lunch 150 gcash', '2026-10-14');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.balances.GCash, s0.balances.GCash - 15000);
  assert.equal(r.state.balances.Cash, s0.balances.Cash);
});

test('sandbox: a transfer to Savings moves money from spendable to savings without changing the total', () => {
  const s0 = startSandbox();
  const r = runSandbox(s0, 'transfer 500 from gcash to savings', '2026-10-14');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.balances.GCash, s0.balances.GCash - 50000);
  assert.equal(r.state.balances.Savings, s0.balances.Savings + 50000);
  const sum = (b: Record<string, number>) => Object.values(b).reduce((a, x) => a + x, 0);
  assert.equal(sum(r.state.balances), sum(s0.balances));
});

test('sandbox: unclear input explains what to type; the sample is capped', () => {
  const bad = runSandbox(startSandbox(), 'hello', '2026-10-14');
  assert.ok(!bad.ok && /Try/.test(bad.message));
  let s = startSandbox();
  for (let i = 0; i < 40; i++) {
    const r = runSandbox(s, 'coffee 10 cash', '2026-10-14');
    if (!r.ok) {
      assert.match(r.message, /account/i);
      return;
    }
    s = r.state;
  }
  assert.fail('the sample should be capped');
});

test('sandbox: steps unlock in order: log an expense, move to savings, then the goal fills', () => {
  let s = startSandbox();
  assert.equal(sandboxStep(s), 1);
  const a = runSandbox(s, 'lunch 150 gcash', '2026-10-14');
  assert.ok(a.ok);
  if (!a.ok) return;
  s = a.state;
  assert.equal(sandboxStep(s), 2);
  const b = runSandbox(s, 'transfer 500 from gcash to savings', '2026-10-14');
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(sandboxStep(b.state), 3);
  assert.ok(SANDBOX_GOAL_MINOR > b.state.balances.Savings);
});

test("game: today's quest is the first unfinished one, and nothing is left to do once all are done", () => {
  assert.equal(gameView([], 0, '2026-10-14').quest?.id, 'first');
  const dates = ['2026-10-14', '2026-10-14', '2026-10-14'];
  assert.equal(gameView(dates, 3, '2026-10-14').quest?.id, 'five'); // first and triple tap are done, the weekly one is next
  const week = Array.from({ length: 7 }, (_, i) => `2026-10-${String(14 - i).padStart(2, '0')}`);
  assert.equal(gameView([...week, '2026-10-14', '2026-10-14'], 9, '2026-10-14').quest, null);
});

import { cleanName, firstName, writeError } from '../native/src/logic.ts';
import { minorToInput } from '../src/lib/validate.ts';
test('settings: a display name is trimmed, single-spaced, 1 to 40 characters, with a message that says what to fix', () => {
  assert.deepEqual(cleanName('  Ced   B  '), { ok: true, name: 'Ced B' });
  const empty = cleanName('   ');
  assert.ok(!empty.ok && /name/i.test(empty.message));
  const long = cleanName('x'.repeat(41));
  assert.ok(!long.ok && /40/.test(long.message));
});

test('home: entries with no account count in Total and Spendable, exactly like the website', () => {
  const v = homeView({ ...snap(), noAccount: 12345 });
  assert.deepEqual({ spendable: v.spendable, savings: v.savings, total: v.total }, { spendable: 362345, savings: 400000, total: 762345 });
});

test('settings: the greeting uses the first word but the name field keeps the whole name', () => {
  assert.equal(firstName('Ced Bernardo'), 'Ced');
  assert.equal(firstName('  Ced  '), 'Ced');
  assert.equal(firstName(''), '');
});

test('write errors: a full cap, a duplicate and anything else each get their own clear message', () => {
  assert.match(writeError({ message: 'row limit PRLIM', code: 'PRLIM' }, 'goal') ?? '', /at most 12 goals/);
  assert.match(writeError({ message: 'x', code: 'PRLIM' }, 'budget') ?? '', /budgets/);
  assert.match(writeError({ message: 'dup', code: '23505' }, 'goal', 'New phone') ?? '', /already have a goal called "New phone"/);
  assert.match(writeError({ message: 'boom' }, 'goal') ?? '', /Try again/);
  assert.equal(writeError(null, 'goal'), null);
});

test('money text for an edit field is built from integers (no floats)', () => {
  assert.equal(minorToInput(123456), '1234.56');
  assert.equal(minorToInput(5), '0.05');
  assert.equal(minorToInput(300000), '3000.00');
});
