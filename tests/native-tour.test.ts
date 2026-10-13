import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TOUR } from '../native/src/tourContent.ts';

test('the tour covers exactly the real bottom tabs, in order', () => {
  assert.deepEqual(
    TOUR.map((x) => x.id),
    ['home', 'activity', 'accounts', 'budgets', 'goals', 'more'],
  );
});

test('the tour ids match the tab bar in Tabs.tsx', () => {
  const src = fs.readFileSync('native/src/Tabs.tsx', 'utf8');
  const ids = [...src.matchAll(/\['(\w+)', '[^']+', '[^']+'\]/g)].map((m) => m[1]);
  assert.deepEqual(
    ids,
    TOUR.map((x) => x.id),
  );
});

test('no slide has empty text and every slide has an example', () => {
  for (const x of TOUR) {
    for (const k of ['id', 'emoji', 'title', 'text', 'example'] as const) assert.ok(x[k].trim().length > 0, `${x.id}.${k}`);
  }
});

test('the tour mentions the key things the owner asked about', () => {
  const all = TOUR.map((x) => x.text + x.example).join(' ');
  assert.match(all, /delete/i);
  assert.match(all, /delete data/i);
});

test('the tour screen has Skip, Back, Next and Got it, and honors reduced motion', () => {
  const src = fs.readFileSync('native/src/TabTour.tsx', 'utf8');
  for (const w of ['Skip', 'Back', 'Next', 'Got it']) assert.ok(src.includes(w), w);
  assert.match(src, /isReduceMotionEnabled/);
  assert.ok(src.split('\n').length < 400);
});
