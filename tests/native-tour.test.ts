import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TOUR } from '../native/src/tourContent.ts';

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

test('every tab has a step that points at its own tab icon', () => {
  for (const id of ['home', 'activity', 'accounts', 'budgets', 'goals', 'more']) {
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

test('steps that can point at an empty list say what appears there', () => {
  for (const id of ['home:recent', 'activity:rows', 'accounts:rows', 'budgets:card', 'goals:card']) {
    const s = TOUR.find((x) => x.targetId === id);
    assert.ok(s?.emptyText, id);
    assert.match(sources(), new RegExp(`id="${id}" empty`)); // a placeholder target exists when the list is empty
  }
  assert.match(TOUR.find((x) => x.targetId === 'activity:rows')?.emptyText ?? '', /Your entries will appear here/);
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

test('Settings steps name the real labels and mention Personalize', () => {
  const t = text('more');
  for (const w of ['Delete my records', 'Delete my account', 'Personalize', 'Tools', 'Help']) assert.ok(t.includes(w), w);
  assert.match(t, /ALL|everything/);
  assert.doesNotMatch(t, /sample data/i);
  const src = read('Settings.tsx');
  for (const w of ['Delete my records', 'Delete my account', 'Tools']) assert.ok(src.includes(w), w);
});

test('Activity and Home steps match the real screens', () => {
  assert.match(text('activity'), /Spent|Earned|Moved/);
  assert.doesNotMatch(text('activity'), /Expenses/);
  for (const w of ['Total', 'Spendable', 'Savings', 'Add']) assert.ok(text('home').includes(w), w);
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
