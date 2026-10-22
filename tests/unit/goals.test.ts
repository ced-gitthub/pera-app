import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoalForm, goalProgress, GOAL_EMOJIS, GOAL_NAME_MAX } from '../../src/lib/progress/goals.ts';
const ACCTS = ['a-1', 'a-2'];
const ok = (o: Partial<{ name: string; emoji: string; amount: string; account: string }> = {}) =>
  parseGoalForm({ name: 'New phone', emoji: '📱', amount: '5,000', account: 'a-1', ...o }, ACCTS);
test('a good form becomes a goal in integer centavos', () => {
  const r = ok();
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.goal.name, 'New phone');
  assert.equal(r.goal.target_minor, 500000);
  assert.equal(r.goal.account_id, 'a-1');
  assert.equal(r.goal.emoji, '📱');
});
test('names are trimmed, squashed and length limited', () => {
  const r = ok({ name: '  Emergency    fund  ' });
  assert.ok(r.ok && r.goal.name === 'Emergency fund');
  assert.equal(ok({ name: '   ' }).ok, false);
  assert.equal(ok({ name: 'x'.repeat(GOAL_NAME_MAX + 1) }).ok, false);
  assert.equal(ok({ name: 'x'.repeat(GOAL_NAME_MAX) }).ok, true);
});
test('amounts must be a real positive peso amount (never a float, never zero or negative)', () => {
  for (const bad of ['', '0', '-5', 'abc', '12.345', '1e6', '100000000000000']) assert.equal(ok({ amount: bad }).ok, false, bad);
  const r = ok({ amount: '1234.5' });
  assert.ok(r.ok && r.goal.target_minor === 123450);
});
test('the emoji must be one of the offered ones, else a default is used', () => {
  const r = ok({ emoji: '💣<script>' });
  assert.ok(r.ok && GOAL_EMOJIS.includes(r.goal.emoji));
  assert.ok(r.ok && r.goal.emoji === GOAL_EMOJIS[0]);
});
test('a connected account must be one of the user own accounts; empty means not connected', () => {
  assert.ok(ok({ account: '' }).ok && (ok({ account: '' }) as { goal: { account_id: string | null } }).goal.account_id === null);
  assert.equal(ok({ account: 'someone-elses' }).ok, false);
});
test('progress: percentage, remaining and reached', () => {
  const p = goalProgress(500000, 125000);
  assert.deepEqual(
    { pct: p.pct, remaining: p.remaining, reached: p.reached, have: p.have },
    { pct: 25, remaining: 375000, reached: false, have: 125000 },
  );
  const done = goalProgress(500000, 500000);
  assert.ok(done.reached && done.pct === 100 && done.remaining === 0);
  const over = goalProgress(500000, 900000);
  assert.ok(over.reached && over.pct === 100 && over.remaining === 0);
});
test('progress never shows 100% until the goal is really reached, and never goes negative', () => {
  assert.equal(goalProgress(500000, 499999).pct, 99);
  assert.equal(goalProgress(500000, 499999).reached, false);
  const neg = goalProgress(500000, -30000);
  assert.ok(neg.pct === 0 && neg.have === 0 && neg.remaining === 500000);
});
