import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flashDirection,
  burstFor,
  burstParticles,
  staggerDelay,
  dur,
  dotsFilled,
  MAX_PARTICLES,
} from '../native/src/welcomeMotionLogic.ts';

test('flash: money in is up, money out is down, no change is none', () => {
  assert.equal(flashDirection(1000, 1500), 'up');
  assert.equal(flashDirection(1500, 1000), 'down');
  assert.equal(flashDirection(1000, 1000), 'none');
});

test('flash: ignores non-finite numbers', () => {
  assert.equal(flashDirection(NaN, 5), 'none');
  assert.equal(flashDirection(5, Infinity), 'none');
});

test('burst: nothing unless a mission was completed (step moved forward)', () => {
  assert.equal(burstFor(1, 1), 'none');
  assert.equal(burstFor(2, 2), 'none');
  assert.equal(burstFor(3, 3), 'none');
  assert.equal(burstFor(2, 1), 'none');
});

test('burst: small for missions 1 and 2, big when mission 3 is reached', () => {
  assert.equal(burstFor(1, 2), 'small');
  assert.equal(burstFor(2, 3), 'big');
  assert.equal(burstFor(1, 3), 'big');
});

test('particles: none for none, bigger burst has more, all capped', () => {
  assert.deepEqual(burstParticles('none', false), []);
  const small = burstParticles('small', false);
  const big = burstParticles('big', false);
  assert.ok(small.length > 0);
  assert.ok(big.length > small.length);
  assert.ok(big.length <= MAX_PARTICLES);
});

test('particles: deterministic, spread around the circle, finite, with emoji and delays', () => {
  const a = burstParticles('big', false);
  assert.deepEqual(a, burstParticles('big', false));
  for (const p of a) {
    assert.ok(Number.isFinite(p.dx) && Number.isFinite(p.dy) && Number.isFinite(p.rotate));
    assert.ok(p.emoji.length > 0);
    assert.ok(p.delay >= 0 && p.delay < 300);
    assert.ok(p.size === 's' || p.size === 'm');
  }
  assert.ok(a.some((p) => p.dx > 0) && a.some((p) => p.dx < 0), 'spreads left and right');
  assert.ok(
    a.some((p) => p.dy < 0),
    'some fly upward',
  );
  assert.equal(new Set(a.map((p) => `${p.dx},${p.dy}`)).size, a.length, 'no two particles overlap');
});

test('particles: reduced motion spawns none', () => {
  assert.deepEqual(burstParticles('big', true), []);
  assert.deepEqual(burstParticles('small', true), []);
});

test('stagger: grows with the index, never negative, zero when reduced', () => {
  assert.equal(staggerDelay(0, false), 0);
  assert.ok(staggerDelay(2, false) > staggerDelay(1, false));
  assert.equal(staggerDelay(3, true), 0);
  assert.equal(staggerDelay(-2, false), 0);
});

test('dur: reduced motion shortens to zero, otherwise keeps the base', () => {
  assert.equal(dur(400, false), 400);
  assert.equal(dur(400, true), 0);
});

test('dots: how many of the 3 progress dots are filled for each step', () => {
  assert.deepEqual(
    [1, 2, 3].map((s) => dotsFilled(s as 1 | 2 | 3)),
    [1, 2, 3],
  );
  assert.equal(dotsFilled(1), 1);
});
