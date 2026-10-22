import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuests, levelInfo, xpFor, tipFor, daysLoggedLast7 } from '../../src/lib/progress/quests.ts';
const TODAY = '2026-10-13';
const base = { today: TODAY, dates: [] as string[], budgets: [] as { spent: number; amount: number }[], totalEntries: 0, streak: 0 };
const q = (i: Partial<typeof base>, id: string) => buildQuests({ ...base, ...i }).find((x) => x.id === id)!;
test('with nothing logged no quest is done and each shows its progress', () => {
  const all = buildQuests(base);
  assert.ok(all.every((x) => !x.done));
  assert.deepEqual(
    all.map((x) => x.id),
    ['first', 'three', 'five', 'seven'],
    'budget quest is hidden when the user has no budgets',
  );
  assert.equal(q({}, 'three').have, 0);
});
test('daily quests count only today entries', () => {
  const dates = [TODAY, TODAY, '2026-10-12', '2026-10-12', '2026-10-12'];
  assert.equal(q({ dates }, 'first').done, true);
  const three = q({ dates }, 'three');
  assert.equal(three.done, false);
  assert.equal(three.have, 2);
  assert.equal(q({ dates: [TODAY, TODAY, TODAY] }, 'three').done, true);
});
test('the budget quest appears only with budgets and needs no budget to be exceeded', () => {
  const b = (spent: number, amount = 10000) => ({ spent, amount });
  assert.equal(q({ budgets: [b(4000), b(9996)] }, 'budget').done, true, '9,996 of 10,000 is still within the budget');
  assert.equal(q({ budgets: [b(10000)] }, 'budget').done, true, 'spending exactly the budget is not over it');
  const over = q({ budgets: [b(4000), b(10001)] }, 'budget');
  assert.equal(over.done, false);
  assert.equal(over.have, 1);
  assert.equal(over.need, 2);
});
test('"5 of 7" counts distinct days in the last seven days, and "7-day streak" follows the streak', () => {
  const days = ['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09'];
  assert.equal(daysLoggedLast7(days, TODAY), 5);
  assert.equal(daysLoggedLast7([...days, ...days, '2026-10-01'], TODAY), 5, 'duplicates and old days are ignored');
  assert.equal(q({ dates: days }, 'five').done, true);
  assert.equal(q({ dates: days.slice(0, 4) }, 'five').done, false);
  assert.equal(q({ streak: 7 }, 'seven').done, true);
  assert.equal(q({ streak: 3 }, 'seven').have, 3);
  assert.equal(q({ streak: 40 }, 'seven').have, 7, 'progress is capped at the goal');
});
test('xp grows with entries and streak, and levels climb with xp', () => {
  assert.equal(xpFor({ totalEntries: 0, streak: 0 }), 0);
  assert.ok(xpFor({ totalEntries: 10, streak: 2 }) > xpFor({ totalEntries: 10, streak: 0 }));
  const a = levelInfo(0),
    b = levelInfo(150),
    top = levelInfo(1_000_000);
  assert.equal(a.level, 1);
  assert.ok(b.level > a.level);
  assert.equal(top.to, null, 'the top level has no next level');
  assert.equal(top.pct, 100);
  assert.ok(a.pct >= 0 && a.pct <= 100 && b.pct >= 0 && b.pct <= 100);
  assert.ok(b.toNext > 0);
});
test('the daily tip is stable for a day and changes between days', () => {
  assert.equal(tipFor('2026-10-13'), tipFor('2026-10-13'));
  const tips = new Set(Array.from({ length: 14 }, (_, i) => tipFor(`2026-10-${String(i + 1).padStart(2, '0')}`)));
  assert.ok(tips.size > 3);
});
