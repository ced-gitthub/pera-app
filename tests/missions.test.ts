import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMissions } from '../src/lib/missions.ts';
const none = { totalEntries: 0, accounts: [{ opening_balance_minor: 0 }], budgetsCount: 0, goalsCount: 0, streak: 0 };
const m = (o: Partial<typeof none> = {}) => buildMissions({ ...none, ...o });
test('a brand-new user has five undone missions and the first is next', () => {
  const r = m();
  assert.equal(r.missions.length, 5);
  assert.equal(r.doneCount, 0);
  assert.equal(r.complete, false);
  assert.equal(r.next, 'first');
  assert.ok(r.missions.every((x) => !x.done && x.href && x.title && x.hint));
});
test('each mission completes from real data', () => {
  assert.equal(m({ totalEntries: 1 }).missions.find((x) => x.id === 'first')!.done, true);
  assert.equal(
    m({ accounts: [{ opening_balance_minor: 0 }, { opening_balance_minor: 500000 }] }).missions.find((x) => x.id === 'balance')!.done,
    true,
  );
  assert.equal(m({ budgetsCount: 1 }).missions.find((x) => x.id === 'budget')!.done, true);
  assert.equal(m({ goalsCount: 1 }).missions.find((x) => x.id === 'goal')!.done, true);
  assert.equal(m({ streak: 2 }).missions.find((x) => x.id === 'streak')!.done, false);
  assert.equal(m({ streak: 3 }).missions.find((x) => x.id === 'streak')!.done, true);
});
test('the next mission is the first one not done, in order', () => {
  assert.equal(m({ totalEntries: 4 }).next, 'balance');
  assert.equal(m({ totalEntries: 4, accounts: [{ opening_balance_minor: 100 }] }).next, 'budget');
  assert.equal(m({ totalEntries: 4, accounts: [{ opening_balance_minor: 100 }], budgetsCount: 2 }).next, 'goal');
});
test('when everything is done the set is complete and nothing is next', () => {
  const r = m({ totalEntries: 9, accounts: [{ opening_balance_minor: 100 }], budgetsCount: 1, goalsCount: 1, streak: 5 });
  assert.equal(r.complete, true);
  assert.equal(r.next, null);
  assert.equal(r.doneCount, 5);
});
test('only the NEXT mission is flagged, never more than one', () => {
  const r = m({ totalEntries: 1 });
  assert.equal(r.missions.filter((x) => x.next).length, 1);
  assert.equal(r.missions.find((x) => x.next)!.id, 'balance');
});
