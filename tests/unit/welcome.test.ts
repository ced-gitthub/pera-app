import test from 'node:test';
import assert from 'node:assert/strict';
import { startDemo, addEntry, levelFor, loginCaption, DEMO_GOAL } from '../../src/lib/landing/welcomeDemo.ts';
const TODAY = '2026-10-12';
const bal = (s: ReturnType<typeof startDemo>, name: string) => s.balances[name];
test('demo starts with sample money, no entries and no streak', () => {
  const s = startDemo();
  assert.equal(s.entries.length, 0);
  assert.ok(Object.values(s.balances).every((v) => v > 0));
  assert.equal(levelFor(s.entries.length).step, 0);
});
test('an expense lowers its account and is listed with category and emoji', () => {
  const s0 = startDemo(),
    r = addEntry(s0, 'lunch 150 gcash', TODAY);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(bal(r.state, 'GCash'), bal(s0, 'GCash') - 15000);
  assert.equal(r.state.entries.length, 1);
  assert.equal(r.state.entries[0].category, 'Food');
  assert.equal(r.state.entries[0].amount_minor, 15000);
  assert.equal(bal(s0, 'GCash'), bal(startDemo(), 'GCash'), 'the previous state is never mutated');
});
test('income raises an account; a transfer moves money without changing the total', () => {
  const s0 = startDemo(),
    inc = addEntry(s0, 'salary 5000 bpi', TODAY);
  assert.ok(inc.ok);
  if (!inc.ok) return;
  assert.equal(bal(inc.state, 'BPI'), bal(s0, 'BPI') + 500000);
  const tr = addEntry(s0, 'transfer 300 from bpi to cash', TODAY);
  assert.ok(tr.ok);
  if (!tr.ok) return;
  assert.equal(bal(tr.state, 'BPI'), bal(s0, 'BPI') - 30000);
  assert.equal(bal(tr.state, 'Cash'), bal(s0, 'Cash') + 30000);
});
test('unreadable input gives a friendly message and changes nothing', () => {
  const s0 = startDemo(),
    r = addEntry(s0, 'hello there', TODAY);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.message.length > 5);
  const empty = addEntry(s0, '   ', TODAY);
  assert.equal(empty.ok, false);
});
test('the demo is capped so it can never grow without bound', () => {
  let s = startDemo();
  for (let i = 0; i < 60; i++) {
    const r = addEntry(s, 'coffee 10 cash', TODAY);
    if (r.ok) s = r.state;
  }
  assert.ok(s.entries.length <= 25);
});
test('levels climb with entries and finish at the goal', () => {
  assert.equal(levelFor(0).title, 'Getting started');
  assert.equal(levelFor(DEMO_GOAL).done, true);
  assert.equal(levelFor(DEMO_GOAL - 1).done, false);
  assert.ok(levelFor(1).step > levelFor(0).step);
});
test('the login caption says "Welcome back" only for returning users', () => {
  assert.match(loginCaption(true), /Welcome back/);
  assert.doesNotMatch(loginCaption(false), /Welcome back/);
});
import { tutorialStep, demoNet, foodSpent, DEMO_GOAL_MINOR, DEMO_BUDGET_MINOR } from '../../src/lib/landing/welcomeDemo.ts';
const feed = (...lines: string[]) => {
  let s = startDemo();
  for (const l of lines) {
    const r = addEntry(s, l, TODAY);
    if (r.ok) s = r.state;
  }
  return s;
};
test('tutorial: five guided steps, each unlocked by doing the previous one', () => {
  const none = { goal: false, budget: false };
  assert.equal(tutorialStep(startDemo(), none).n, 1);
  const one = feed('lunch 150 gcash');
  assert.equal(tutorialStep(one, none).n, 2, 'after the first entry it asks for income');
  const inc = feed('lunch 150 gcash', 'salary 5000 bpi');
  assert.equal(tutorialStep(inc, none).n, 3, 'after income it asks for a goal');
  assert.equal(tutorialStep(inc, { goal: true, budget: false }).n, 4);
  const all = tutorialStep(inc, { goal: true, budget: true });
  assert.ok(all.n === 5 && all.done);
  assert.ok(tutorialStep(startDemo(), none).title.length > 3 && tutorialStep(startDemo(), none).tip.length > 10);
});
test('tutorial progress counts completed steps (0 to 4) and never exceeds 100%', () => {
  const none = { goal: false, budget: false };
  assert.equal(tutorialStep(startDemo(), none).completed, 0);
  const inc = feed('lunch 150 gcash', 'salary 5000 bpi');
  assert.equal(tutorialStep(inc, { goal: true, budget: true }).completed, 4);
  assert.equal(tutorialStep(inc, { goal: true, budget: true }).pct, 100);
  assert.equal(tutorialStep(inc, none).pct, 50);
});
test('demo goal and budget are driven by the entries the visitor typed', () => {
  assert.equal(DEMO_GOAL_MINOR, 1000000);
  assert.equal(DEMO_BUDGET_MINOR, 200000);
  const s = feed('salary 5000 bpi', 'lunch 150 gcash');
  assert.equal(demoNet(s), 485000, 'income minus expenses');
  assert.equal(foodSpent(s), 15000);
  assert.equal(demoNet(startDemo()), 0);
  assert.equal(foodSpent(feed('grocery 800 cash')), 0, 'only Food counts toward the Food budget');
});
