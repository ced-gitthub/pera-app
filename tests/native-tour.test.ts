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

const slide = (id: string) => {
  const x = TOUR.find((y) => y.id === id);
  assert.ok(x, id);
  return `${x.text} ${x.example}`;
};

test('Accounts slide points to Manage for rename and starting balance, and the app has that button', () => {
  const t = slide('accounts');
  assert.match(t, /Manage/);
  assert.doesNotMatch(t, /tap (an account|cash)[^.]*(rename|starting balance)/i);
  assert.match(fs.readFileSync('native/src/AccountsTab.tsx', 'utf8'), /gearLabel="Manage"/);
});

test('Goals slide does not claim you can add money to a goal', () => {
  const t = slide('goals');
  assert.doesNotMatch(t, /add (money )?to a goal|add \d/i);
  assert.match(t, /linked account/i);
  assert.match(t, /income/i);
});

test('Settings slide names Delete data and says it removes everything, not only samples', () => {
  const t = slide('more');
  assert.match(t, /Delete data/);
  assert.match(t, /all|everything/i);
  assert.doesNotMatch(t, /sample data/i);
  assert.match(fs.readFileSync('native/src/Settings.tsx', 'utf8'), /Delete data/);
});

test('Activity example uses real filter chip names; Home slide matches the Home screen', () => {
  assert.match(slide('activity'), /Spent|Earned|Moved/);
  assert.doesNotMatch(slide('activity'), /Expenses/);
  const home = slide('home');
  for (const w of ['Total', 'Spendable', 'Savings', 'Add']) assert.ok(home.includes(w), w);
});

test('Settings hint line says it deletes ALL, including real ones', () => {
  const src = fs.readFileSync('native/src/Settings.tsx', 'utf8').replace(/\s+/g, ' ');
  assert.ok(
    src.includes(
      'Deletes ALL of your entries, budgets or goals (including real ones, not just the tutorial samples). You are asked to type DELETE to confirm.',
    ),
  );
  assert.doesNotMatch(src, /Clear the sample entries/);
});

test('the tour screen has Skip, Back, Next and Got it, and honors reduced motion', () => {
  const src = fs.readFileSync('native/src/TabTour.tsx', 'utf8');
  for (const w of ['Skip', 'Back', 'Next', 'Got it']) assert.ok(src.includes(w), w);
  assert.match(src, /isReduceMotionEnabled/);
  assert.ok(src.split('\n').length < 400);
});
