import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moodIndex,
  sceneStops,
  headlineFor,
  progressFraction,
  sandboxXp,
  xpGain,
  badgeFor,
  floatersFor,
  MAX_FLOATERS,
  heroTint,
  parallaxShift,
} from '../../native/src/welcomeSceneLogic.ts';
import { c } from '../../native/src/uiTokens.ts';

test('mood: mission 1 is cool, 2 is mint, 3 is gold (index 0,1,2)', () => {
  assert.deepEqual(
    [1, 2, 3].map((s) => moodIndex(s as 1 | 2 | 3)),
    [0, 1, 2],
  );
});

test('stops: one colour per mood for the page and each blob, all from tokens', () => {
  const st = sceneStops();
  assert.deepEqual(st.inputRange, [0, 1, 2]);
  assert.deepEqual(st.bg, c.scene.bg);
  assert.equal(st.blobs.length, 3);
  for (const b of st.blobs) assert.equal(b.length, 3);
  assert.deepEqual(st.blobs[0], c.scene.blobA);
});

test('headline changes with the mission', () => {
  assert.equal(headlineFor(1), 'Type a line. See what is left.');
  assert.equal(headlineFor(2), 'Pay yourself first.');
  assert.equal(headlineFor(3), 'You are in control.');
});

test('progress track fills as missions complete and is never empty or over full', () => {
  assert.ok(progressFraction(1) > 0 && progressFraction(1) < progressFraction(2));
  assert.ok(progressFraction(2) < progressFraction(3));
  assert.equal(progressFraction(3), 1);
});

test('xp: missions give a bonus plus 5 per entry; levels follow quests.ts', () => {
  assert.equal(sandboxXp(1, 0), 0);
  assert.equal(sandboxXp(2, 1), 55);
  assert.equal(sandboxXp(3, 2), 110);
  assert.equal(xpGain(1, 0, 2, 1), 55);
  assert.equal(xpGain(3, 2, 3, 3), 5);
  assert.equal(badgeFor(1, 0), null); // pops in only after mission 1
  assert.equal(badgeFor(2, 1)?.title, 'Broke Rookie');
  assert.equal(badgeFor(3, 2)?.title, 'Peso Pincher');
  assert.equal(badgeFor(3, 2)?.level, 2);
});

test('xp: entries are capped so a long session cannot overflow', () => {
  assert.ok(sandboxXp(3, 9999) <= 400);
});

test('floaters: capped, deterministic, none with reduced motion, more as the mood warms up', () => {
  assert.ok(MAX_FLOATERS <= 12);
  assert.deepEqual(floatersFor(0, true), []);
  const a = floatersFor(2, false);
  assert.deepEqual(a, floatersFor(2, false));
  assert.ok(a.length <= MAX_FLOATERS);
  assert.ok(floatersFor(0, false).length < a.length);
  for (const f of a) {
    assert.ok(f.leftPct >= 0 && f.leftPct <= 100);
    assert.ok(f.duration >= 6000 && f.delay >= 0);
  }
  assert.ok(new Set(a.map((f) => f.leftPct)).size > 5); // spread across the width
});

test('hero tint follows the savings share, clamped 0..1', () => {
  assert.equal(heroTint(0), 0);
  assert.equal(heroTint(1), 1);
  assert.ok(heroTint(0.55) > heroTint(0.45));
  assert.equal(heroTint(NaN), 0);
  assert.equal(heroTint(-3), 0);
});

test('parallax shift scales with depth and is clamped', () => {
  assert.equal(parallaxShift(100, 0.2), -20);
  assert.equal(parallaxShift(-50, 0.2), 0); // overscroll bounce does not move it
  assert.equal(parallaxShift(100000, 0.5), -200);
});
