import test from 'node:test';
import assert from 'node:assert/strict';
import { gateFor, needsWizard, openingFromToday } from '../src/lib/onboarding.ts';
const base = { totalEntries: 0, accounts: [{ opening_balance_minor: 0 }], budgetsCount: 0, goalsCount: 0, streak: 0 };
const fresh = { onboarded: false, wizard: false },
  T = (n: string, ok: boolean) => test(n, () => assert.ok(ok));
const g = (i: object, c = fresh) => gateFor({ ...base, ...i }, c);
T(
  'a brand new account starts at step 1 of 5',
  (() => {
    const r = g({});
    return r.show && r.step === 'first' && r.number === 1 && r.total === 5;
  })(),
);
T(
  'after the first entry it moves to balances (2 of 5)',
  (() => {
    const r = g({ totalEntries: 1 });
    return r.show && r.step === 'balance' && r.number === 2;
  })(),
);
T(
  'a non-zero opening balance moves it to the budget (3 of 5)',
  (() => {
    const r = g({ totalEntries: 1, accounts: [{ opening_balance_minor: 5000 }] });
    return r.show && r.step === 'budget' && r.number === 3;
  })(),
);
T(
  'a budget moves it to the goal (4 of 5)',
  (() => {
    const r = g({ totalEntries: 1, accounts: [{ opening_balance_minor: 5000 }], budgetsCount: 1 });
    return r.show && r.step === 'goal' && r.number === 4;
  })(),
);
T(
  'steps cannot be skipped: a goal without the other steps still asks for step 1',
  (() => {
    const r = g({ goalsCount: 1 });
    return r.show && r.step === 'first';
  })(),
);
const all = { totalEntries: 2, accounts: [{ opening_balance_minor: 100 }], budgetsCount: 1, goalsCount: 1 };
T(
  'all four done + wizard cookie: closing slide (5 of 5)',
  (() => {
    const r = g(all, { onboarded: false, wizard: true });
    return r.show && r.step === 'finish' && r.number === 5;
  })(),
);
T(
  'all four done, never toured on this device: the example walkthrough shows once',
  (() => {
    const r = g(all);
    return r.show && r.step === 'tour' && r.number === 1;
  })(),
);
T(
  'finished cookie skips everything',
  (() => {
    const r = g({}, { onboarded: true, wizard: false });
    return !r.show && !r.mark;
  })(),
);
T(
  'the streak never blocks',
  (() => {
    const r = g({ ...all, streak: 0 }, { onboarded: false, wizard: false, toured: true });
    return !r.show;
  })(),
);
T('typed 1000 with a -150 entry logged stores an opening balance of 1150', openingFromToday(100000, -15000, 0) === 115000);
T('a balance with an existing opening and income counts the movement only', openingFromToday(50000, 30000, 10000) === 30000);
T('an absurdly large amount is refused', openingFromToday(99_999_999_999 * 2, 0, 0) === null);
T(
  'existing accounts are gated too until they finish the steps',
  needsWizard('2020-01-01T00:00:00Z') && needsWizard('2030-01-01T00:00:00Z') && !needsWizard(undefined),
);
T(
  'typing exactly the current balance (opening stays 0) still moves step 2 on to step 3 once submitted',
  (() => {
    const i = { totalEntries: 1 },
      stuck = g(i),
      moved = g(i, { onboarded: false, wizard: false, balances: true } as typeof fresh);
    return stuck.show && stuck.step === 'balance' && moved.show && moved.step === 'budget' && moved.number === 3;
  })(),
);
T(
  'all four done and already toured: let in and remember',
  (() => {
    const r = g(all, { onboarded: false, wizard: false, toured: true });
    return !r.show && r.mark;
  })(),
);
