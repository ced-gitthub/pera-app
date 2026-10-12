import test from 'node:test';
import assert from 'node:assert/strict';
import { startDemo, addEntry, levelFor, loginCaption, DEMO_GOAL } from '../src/lib/welcomeDemo.ts';
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
