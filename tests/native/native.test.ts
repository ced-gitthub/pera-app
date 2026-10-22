import { test } from 'node:test';
import { budgetStatus } from '../../src/core/aggregate.ts';
import assert from 'node:assert/strict';
import {
  preview,
  missingFeeCategories,
  newRequestId,
  planBalances,
  planBudget,
  monthRange,
  budgetProgress,
  netFromSummary,
  sendCodeError,
  type Snapshot,
} from '../../native/src/logic.ts';

const snap: Snapshot = {
  accounts: [
    { id: 'a1', name: 'Cash', short_name: null, counts_as_savings: false, opening_balance_minor: 0, show_on_home: true },
    { id: 'a2', name: 'GCash', short_name: null, counts_as_savings: false, opening_balance_minor: 0, show_on_home: true },
    { id: 'a3', name: 'BPI', short_name: null, counts_as_savings: false, opening_balance_minor: 0, show_on_home: true },
  ],
  categories: [{ id: 'c1', name: 'Food', type: 'expense' }],
  balances: { a1: 100000, a2: 100000, a3: 100000 },
  recent: [],
};

test('native preview reuses the website parser: integer centavos, Manila date', () => {
  const p = preview('lunch 150 gcash', snap, '2026-10-13');
  assert.equal(p.problems.length, 0);
  assert.equal(p.items[0].amount_minor, 15000);
  assert.equal(p.items[0].category, 'Food');
  assert.equal(p.items[0].account, 'GCash');
  assert.equal(p.items[0].date, '2026-10-13');
});

test('native preview reports unclear input instead of guessing', () => {
  const p = preview('hello', snap, '2026-10-13');
  assert.equal(p.items.length, 0);
  assert.ok(p.problems.length > 0);
});

test('native fee categories are created only for fixed fee names', () => {
  const items = [
    { type: 'expense', amount_minor: 1500, category: 'Transfer Fee', description: '', date: '2026-10-13', account: 'GCash' },
    { type: 'expense', amount_minor: 100, category: 'Food', description: '', date: '2026-10-13', account: 'Cash' },
    { type: 'expense', amount_minor: 100, category: 'Made Up', description: '', date: '2026-10-13', account: 'Cash' },
  ] as const;
  assert.deepEqual(missingFeeCategories([...items], snap.categories), ['Transfer Fee']);
  const have = [...snap.categories, { id: 'c2', name: 'transfer fee', type: 'expense' as const }];
  assert.deepEqual(missingFeeCategories([...items], have), []);
});

test('native request ids look like uuids and differ per call', () => {
  const a = newRequestId(),
    b = newRequestId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test('wizard balances: opening = typed minus what is already logged, never touches accounts not on the form', () => {
  // GCash shows 1,000.00 now with an opening of 0 (so 1,000.00 of movement is logged); the person says they have 1,500.00 today.
  const r = planBalances({ a2: '1500' }, snap);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.patch, [{ id: 'a2', v: 50000 }]);
});

test('wizard balances: refuses all-empty and bad amounts with a message that says what to fix', () => {
  const none = planBalances({ a1: '', a2: '0' }, snap);
  assert.ok(!none.ok && /at least one account/.test(none.message));
  const bad = planBalances({ a1: '12abc' }, snap);
  assert.ok(!bad.ok && /not a valid amount for Cash/.test(bad.message));
});

test('wizard budget: expense category and a positive limit, stored for the Manila month', () => {
  const ok = planBudget('c1', '3,000', snap, '2026-10-13');
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.row, { category_id: 'c1', amount_minor: 300000, month: 10, year: 2026 });
  assert.ok(!planBudget('nope', '3000', snap).ok);
  assert.ok(!planBudget('c1', '0', snap).ok);
});

import { decideGate, FINISH_FLAGS, REPLAY_FLAGS, type Flags } from '../../native/src/logic.ts';
const off: Flags = { onboarded: false, wizard: false, balances: false, toured: false };
const none = { totalEntries: 0, budgetsCount: 0, goalsCount: 0 };
const all = { totalEntries: 3, budgetsCount: 1, goalsCount: 1 };
const withBalance = snap.accounts.map((a, i) => ({ ...a, opening_balance_minor: i === 0 ? 5000 : 0 }));

test('gate: a new account is blocked on the first step and the wizard flag is set', () => {
  const d = decideGate(none, snap.accounts, off);
  assert.ok(d.gate.show && d.gate.step === 'first');
  assert.deepEqual(d.set, { wizard: true });
});

test('gate: a read error fails open and changes nothing', () => {
  const d = decideGate(null, snap.accounts, off);
  assert.deepEqual(d, { gate: { show: false, mark: false }, set: {} });
});

test('gate: finished data + wizard flag shows the closing slide; finishing sets onboarded and toured and clears wizard', () => {
  const d = decideGate(all, withBalance, { ...off, wizard: true });
  assert.ok(d.gate.show && d.gate.step === 'finish');
  assert.deepEqual(FINISH_FLAGS, { onboarded: true, toured: true, wizard: false });
  assert.equal(decideGate(all, withBalance, { ...off, onboarded: true, toured: true }).gate.show, false);
});

test('gate: an already set-up account sees the tour once, then onboarded is stored', () => {
  const d = decideGate(all, withBalance, off);
  assert.ok(d.gate.show && d.gate.step === 'tour');
  const after = decideGate(all, withBalance, { ...off, toured: true });
  assert.ok(!after.gate.show);
  assert.deepEqual(after.set, { onboarded: true });
});

test('replay clears the tutorial flags but keeps the balances flag (as the website does)', () => {
  assert.deepEqual(REPLAY_FLAGS, { onboarded: false, toured: false, wizard: false });
  assert.ok(!('balances' in REPLAY_FLAGS));
  // typed balances equal to what is logged leave every opening at 0; the balances flag alone marks step 2 done
  const d = decideGate(all, snap.accounts, { ...off, balances: true });
  assert.ok(d.gate.show && d.gate.step === 'tour');
});

test('wizard balances: negative, too large, untouched accounts and a non-zero existing opening', () => {
  const s2: Snapshot = {
    ...snap,
    accounts: snap.accounts.map((a) => (a.id === 'a2' ? { ...a, opening_balance_minor: 20000 } : a)),
    balances: { a1: 100000, a2: 150000, a3: 100000 },
  };
  // GCash: opening 200.00, balance 1,500.00 (movement 1,300.00); the person has 1,000.00 today -> opening -300.00
  const neg = planBalances({ a2: '1000' }, s2);
  assert.deepEqual(neg.ok && neg.patch, [{ id: 'a2', v: -30000 }]);
  const huge = planBalances({ a1: '99999999999' }, snap);
  assert.ok(!huge.ok);
  const typedNeg = planBalances({ a1: '-50', a2: '10' }, snap);
  assert.ok(typedNeg.ok && !typedNeg.patch.some((p) => p.id === 'a3'));
});

test('budgets: month range handles February and leap years', () => {
  assert.deepEqual(monthRange('2028-02-10'), { from: '2028-02-01', to: '2028-02-29', month: 2, year: 2028 });
  assert.equal(monthRange('2026-10-31').to, '2026-10-31');
});

test('budgets: the app uses the website rule (rounded tenths), so both always agree', () => {
  for (const [limit, spent] of [
    [300000, 120000],
    [100000, 130000],
    [1000000, 1000400],
    [0, 0],
    [0, 500],
    [100000, 80000],
  ]) {
    const a = budgetProgress(limit, spent),
      w = budgetStatus(limit, spent);
    assert.equal(a.state, w.state);
    assert.equal(a.over, w.state === 'over');
  }
  assert.equal(budgetProgress(1000000, 1000400).over, false); // 100.04% rounds to 100.0%: not over
  assert.equal(budgetProgress(0, 500).over, false); // a 0 budget is not 'over' on the website
  assert.deepEqual({ ...budgetProgress(300000, 120000) }, { over: false, left: 180000, overBy: 0, pct: 40, state: 'ok' });
});

test('goals: net since start = income minus expense from period_summary rows, as integers', () => {
  assert.equal(
    netFromSummary([
      { type: 'income', total_minor: '600000' },
      { type: 'expense', total_minor: 150000 },
      { type: 'transfer', total_minor: 9 },
    ]),
    450000,
  );
  assert.equal(netFromSummary([]), 0);
});

test('sign-up errors: shown when creating, hidden when signing in (no account enumeration)', () => {
  assert.match(sendCodeError({ message: 'Signups not allowed for otp', status: 422 }, true) ?? '', /not available/);
  assert.equal(sendCodeError({ message: 'Signups not allowed for otp', status: 422 }, false), null);
  assert.match(sendCodeError({ message: 'fetch failed' }, false) ?? '', /Could not reach/);
  assert.match(sendCodeError({ message: 'email rate limit exceeded', status: 429 }, true) ?? '', /Too many/);
  assert.equal(sendCodeError(null, true), null);
});
