import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padRect, placeTip, scrollDelta, sameRect, nextIndex, type Rect } from '../native/src/coachLogic.ts';

const screen = { w: 375, h: 700 };
const tip = { w: 300, h: 120 };
const edge = { top: 40, bottom: 80 };

test('padRect grows the hole and clamps it inside the screen', () => {
  assert.deepEqual(padRect({ x: 10, y: 100, w: 50, h: 20 }, 8, screen), { x: 2, y: 92, w: 66, h: 36 });
  assert.deepEqual(padRect({ x: 2, y: 2, w: 50, h: 20 }, 8, screen), { x: 0, y: 0, w: 60, h: 30 });
  const big = padRect({ x: 300, y: 650, w: 100, h: 100 }, 8, screen);
  assert.ok(big.x + big.w <= screen.w && big.y + big.h <= screen.h);
});

test('placeTip goes below a target near the top, above one near the bottom', () => {
  const top: Rect = { x: 20, y: 100, w: 100, h: 40 };
  const p = placeTip(top, screen, tip, edge, 12, 16);
  assert.equal(p.side, 'below');
  assert.ok(p.top >= top.y + top.h);
  const low: Rect = { x: 20, y: 560, w: 100, h: 40 };
  const q = placeTip(low, screen, tip, edge, 12, 16);
  assert.equal(q.side, 'above');
  assert.ok(q.top + tip.h <= low.y);
});

test('placeTip keeps the tooltip on screen and the arrow on the target', () => {
  const right: Rect = { x: 300, y: 100, w: 40, h: 40 };
  const p = placeTip(right, screen, tip, edge, 12, 16);
  assert.ok(p.left >= 16 && p.left + tip.w <= screen.w - 16);
  const centre = right.x + right.w / 2;
  assert.ok(Math.abs(p.left + p.arrowX - centre) <= 1);
  const left: Rect = { x: 0, y: 100, w: 20, h: 40 };
  const q = placeTip(left, screen, tip, edge, 12, 16);
  assert.ok(q.left >= 16);
  assert.ok(q.arrowX >= 0 && q.arrowX <= tip.w);
});

test('placeTip with no target centres the tooltip with no arrow side', () => {
  const p = placeTip(null, screen, tip, edge, 12, 16);
  assert.equal(p.side, 'center');
  assert.ok(Math.abs(p.top + tip.h / 2 - screen.h / 2) < screen.h / 4);
});

test('placeTip for a tall target that leaves no room still stays on screen', () => {
  const tall: Rect = { x: 20, y: 50, w: 335, h: 560 };
  const p = placeTip(tall, screen, tip, edge, 12, 16);
  assert.ok(p.top >= edge.top && p.top + tip.h <= screen.h - edge.bottom + 1);
});

test('scrollDelta is 0 when visible and brings an off-screen target into the band', () => {
  const band = { top: 80, bottom: 600 };
  assert.equal(scrollDelta({ x: 0, y: 200, w: 100, h: 50 }, band, 24), 0);
  assert.ok(scrollDelta({ x: 0, y: 700, w: 100, h: 50 }, band, 24) > 0);
  assert.ok(scrollDelta({ x: 0, y: 10, w: 100, h: 50 }, band, 24) < 0);
});

test('sameRect tolerates sub-pixel jitter only', () => {
  assert.ok(sameRect({ x: 1, y: 2, w: 3, h: 4 }, { x: 1.4, y: 2, w: 3, h: 4 }));
  assert.ok(!sameRect({ x: 1, y: 2, w: 3, h: 4 }, { x: 5, y: 2, w: 3, h: 4 }));
  assert.ok(!sameRect(null, { x: 1, y: 2, w: 3, h: 4 }));
});

test('nextIndex clamps and reports finish', () => {
  assert.deepEqual(nextIndex(0, 6, -1), { index: 0, done: false });
  assert.deepEqual(nextIndex(2, 6, 1), { index: 3, done: false });
  assert.deepEqual(nextIndex(5, 6, 1), { index: 5, done: true });
});
