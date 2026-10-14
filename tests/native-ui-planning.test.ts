import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isBudgetDirty, isGoalDirty } from '../native/src/planningDirty.ts';

const src = fs.readFileSync('native/src/Planning.tsx', 'utf8');

test('budget dirty: unchanged is clean, trimmed whitespace is clean', () => {
  const a = { cat: 'c1', amount: '500' };
  assert.equal(isBudgetDirty(a, { ...a }), false);
  assert.equal(isBudgetDirty(a, { cat: 'c1', amount: ' 500 ' }), false);
});
test('budget dirty: a changed amount or category is dirty', () => {
  const a = { cat: 'c1', amount: '500' };
  assert.equal(isBudgetDirty(a, { cat: 'c1', amount: '600' }), true);
  assert.equal(isBudgetDirty(a, { cat: 'c2', amount: '500' }), true);
});
test('goal dirty: unchanged and trimmed are clean', () => {
  const g = { name: 'Phone', emoji: '📱', amount: '20000', account: '' };
  assert.equal(isGoalDirty(g, { ...g }), false);
  assert.equal(isGoalDirty(g, { ...g, name: '  Phone ', amount: '20000 ' }), false);
});
test('goal dirty: each field counts', () => {
  const g = { name: 'Phone', emoji: '📱', amount: '20000', account: '' };
  assert.equal(isGoalDirty(g, { ...g, name: 'Laptop' }), true);
  assert.equal(isGoalDirty(g, { ...g, emoji: '🏠' }), true);
  assert.equal(isGoalDirty(g, { ...g, amount: '1' }), true);
  assert.equal(isGoalDirty(g, { ...g, account: 'a1' }), true);
});

test('planning sheets pass dirty and onSave and pin the save button in the footer', () => {
  assert.equal((src.match(/dirty=\{/g) ?? []).length, 2);
  assert.equal((src.match(/onSave=\{/g) ?? []).length, 2);
  assert.equal((src.match(/footer=\{/g) ?? []).length, 2);
  assert.match(src, /isBudgetDirty\(/);
  assert.match(src, /isGoalDirty\(/);
});
test('planning toasts after save and delete', () => {
  for (const m of ['Budget saved', 'Goal saved', 'Budget deleted', 'Goal deleted']) assert.ok(src.includes(`'${m}'`), m);
  assert.match(src, /useToast\(\)/);
});
test('planning loading skeletons are card-shaped variants', () => {
  assert.match(src, /<ListSkeleton variant="budget" rows=\{3\} \/>/);
  assert.match(src, /<ListSkeleton variant="card" rows=\{3\} \/>/);
});
test('planning long budget names truncate instead of overflowing', () => {
  assert.match(src, /numberOfLines=\{1\}/);
  assert.match(src, /flexShrink: 1/);
});
test('planning has no small tappables', () => {
  assert.doesNotMatch(src, /minHeight: (?:[1-3]?\d|4[0-7])\b/);
});
