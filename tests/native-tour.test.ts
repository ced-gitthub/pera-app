import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TOUR } from '../native/src/tourContent.ts';
import { MEASURE_WAITS, readyToShow } from '../native/src/coachLogic.ts';

const read = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');
const sources = () =>
  fs
    .readdirSync('native/src')
    .filter((f) => /\.tsx$/.test(f) && f !== 'TabTour.tsx')
    .map(read)
    .join('\n');
const text = (tab: string) =>
  TOUR.filter((x) => x.tab === tab)
    .map((x) => `${x.title} ${x.text} ${x.emptyText ?? ''}`)
    .join(' ');

test('every step belongs to a real bottom tab, and every tab is toured in order', () => {
  const ids = [...read('Tabs.tsx').matchAll(/\['(\w+)', '[^']+', '[^']+'\]/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['home', 'activity', 'accounts', 'budgets', 'goals', 'more']);
  for (const x of TOUR) assert.ok(ids.includes(x.tab), `${x.targetId}: unknown tab ${x.tab}`);
  assert.deepEqual([...new Set(TOUR.map((x) => x.tab))], ids);
});

test('every tab except Home (which points at its own content) has a step that points at its own tab icon', () => {
  for (const id of ['activity', 'accounts', 'budgets', 'goals', 'more']) {
    const s = TOUR.find((x) => x.targetId === `tab:${id}`);
    assert.ok(s, id);
    assert.equal(s.tab, id);
    assert.match(s.text, /^This is /);
  }
  assert.match(read('Tabs.tsx'), /id=\{`tab:\$\{id\}`\}/); // the tab bar registers them
});

test('every targetId used by a step is registered by a CoachTarget, gearId or the Fab in the source', () => {
  const src = sources();
  for (const id of new Set(TOUR.map((x) => x.targetId))) {
    if (id.startsWith('tab:')) continue; // checked above
    if (id === 'fab') assert.match(read('Fab.tsx'), /useCoachNode\('fab'\)/);
    else assert.ok(src.includes(`id="${id}"`) || src.includes(`gearId="${id}"`), `no CoachTarget for ${id}`);
  }
});

test('no step has empty words and targets are unique per tab', () => {
  for (const x of TOUR)
    for (const k of ['tab', 'targetId', 'title', 'text'] as const) assert.ok(x[k].trim().length > 0, `${x.targetId}.${k}`);
  const keys = TOUR.map((x) => `${x.tab}/${x.targetId}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('Accounts steps point to Manage, and the app has that button', () => {
  assert.match(text('accounts'), /Manage/);
  assert.match(read('AccountsTab.tsx'), /gearLabel="Manage"/);
});

test('Goals text does not claim you can add money to a goal', () => {
  assert.doesNotMatch(text('goals'), /add (money )?to a goal|add \d/i);
  assert.match(text('goals'), /linked account/i);
  assert.match(text('goals'), /income/i);
});

test('Settings step names the real labels', () => {
  const t = text('more');
  for (const w of ['Delete my records', 'Delete my account', 'Personalize', 'Tools', 'Help']) assert.ok(t.includes(w), w);
  assert.doesNotMatch(t, /sample data/i);
  const src = read('Settings.tsx');
  for (const w of ['Delete my records', 'Delete my account', 'Tools']) assert.ok(src.includes(w), w);
});

test('Activity and Home steps match the real screens', () => {
  assert.match(text('activity'), /Spent|Earned|Moved/);
  assert.doesNotMatch(text('activity'), /Expenses/);
  for (const w of ['Total', 'Spendable', 'Savings', 'Add']) assert.ok(text('home').includes(w), w);
});

test('the tour is short and quick to read: at most 8 steps, each at most 150 characters', () => {
  assert.ok(TOUR.length <= 8, `${TOUR.length} steps`);
  for (const x of TOUR) assert.ok(x.text.length <= 150, `${x.targetId}: ${x.text.length} chars`);
});

test('Next is quick: a short measuring schedule, and a fixed or already-visible target is shown at once', () => {
  assert.ok(MEASURE_WAITS.reduce((n, w) => n + w, 0) <= 400);
  const r = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(readyToShow(true, false, null, r), true); // tab icons and the + button never move
  assert.equal(readyToShow(false, true, null, r), true); // same tab as the last step: already laid out
  assert.equal(readyToShow(false, false, null, r), false); // a new tab: wait for a second matching measure
  assert.equal(readyToShow(false, false, r, { ...r }), true);
  assert.equal(readyToShow(false, false, r, { ...r, y: 40 }), false);
});

test('the overlay has Skip, Back, Next, Got it, a touch blocker, reduced motion, and stays small', () => {
  const src = read('TabTour.tsx');
  for (const w of ['Skip', 'Back', 'Next', 'Got it']) assert.ok(src.includes(w), w);
  assert.match(src, /isReduceMotionEnabled/);
  assert.match(src, /onStartShouldSetResponder/);
  assert.match(src, /measure\(/);
  assert.doesNotMatch(src, /<Modal/); // an overlay on the live app, not a separate screen
  for (const f of ['TabTour.tsx', 'Coach.tsx', 'coachLogic.ts', 'tourContent.ts', 'Gate.tsx', 'Tabs.tsx'])
    assert.ok(read(f).split('\n').length < 400, f);
});

test('Gate switches the real tab for each step and renders the overlay inside the provider', () => {
  const g = read('Gate.tsx');
  assert.match(g, /setTab\(TOUR\[/);
  assert.match(g, /<CoachProvider>/);
  assert.match(g, /<TabTour index=/);
  assert.match(g, /tabTourSeen/);
});

test('the tooltip is never hidden between steps (only the spotlight ring waits for its target), so Next shows the next text at once', () => {
  const src = read('TabTour.tsx');
  assert.match(src, /const tipIn = useRef\(new Animated\.Value\(1\)\)/);
  assert.match(src, /ringIn/);
  assert.doesNotMatch(src, /tipIn\.setValue/);
  assert.doesNotMatch(src, /Animated\.timing\(tipIn/);
});
