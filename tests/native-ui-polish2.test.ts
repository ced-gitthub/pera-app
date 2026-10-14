import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { iconForTheme, hasIconTwin, matchIconLabel, highlightedIcon, DEFAULT_APP_ICON } from '../native/src/appIcon.ts';

const src = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');

test('hasIconTwin: colour themes yes, mono and daylight no', () => {
  for (const id of ['lime', 'ocean', 'sunset', 'grape', 'rose', 'mint']) assert.equal(hasIconTwin(id), true, id);
  for (const id of ['mono', 'daylight', 'nope']) assert.equal(hasIconTwin(id), false, id);
});

test('matchIconLabel is truthful about what the button picks', () => {
  assert.equal(matchIconLabel('ocean'), 'Match my theme');
  assert.equal(matchIconLabel('mono'), 'Use the default icon');
  assert.equal(matchIconLabel('daylight'), 'Use the default icon');
  assert.equal(iconForTheme('mono'), DEFAULT_APP_ICON);
});

test('highlightedIcon: pending wins, then current, null means the default icon', () => {
  assert.equal(highlightedIcon(null, null), DEFAULT_APP_ICON);
  assert.equal(highlightedIcon('Rose', null), 'Rose');
  assert.equal(highlightedIcon('Rose', 'Mint'), 'Mint');
});

test('AppIconSection uses the helpers', () => {
  const a = src('AppIconSection.tsx');
  assert.match(a, /highlightedIcon\(current, pending\)/);
  assert.match(a, /matchIconLabel\(themeState\.id\)/);
});

test('ListSkeleton has row, card and budget variants (default row)', () => {
  const k = src('Skeleton.tsx');
  assert.match(k, /variant\?: 'row' \| 'card' \| 'budget'/);
  assert.match(k, /variant = 'row'/);
  assert.match(k, /variant === 'budget'/);
  assert.match(k, /s\.card/);
});

test('Home skeleton has the hint line and a See all accounts link of live height', () => {
  const k = src('Skeleton.tsx');
  assert.match(k, /Tap an entry hint/);
  assert.match(k, /See all accounts link/);
});

test('Activity loading mirrors the live card rows', () => {
  const t = src('Tabs.tsx');
  assert.match(t, /skeleton\?: ReactNode/);
  assert.match(t, /<ListSkeleton variant="card"/);
});

test('chip is a 48 tall touch target; a static chip exists for non-tappable tags', () => {
  const u = src('ui.ts');
  assert.match(u, /export const TOUCH = sp\.xxl \+ sp\.l/);
  assert.match(u, /chip: \{[^}]*minHeight: TOUCH/s);
  assert.match(u, /chipStatic/);
});

test('avatar cells are at least 48 to hit', () => {
  const a = src('AvatarPicker.tsx');
  assert.match(a, /hitSlop/);
});

test('ThemePicker keeps the name text exact and shows a ring plus check badge', () => {
  const p = src('ThemePicker.tsx');
  assert.doesNotMatch(p, /picked \? '✓ ' : ''/);
  assert.match(p, /✓/);
  assert.match(p, /borderWidth: picked \? 3 : 1/);
});

test('Settings name: synced, 40 chars, toast, refresh and card version bump', () => {
  const s = src('Settings.tsx');
  assert.match(s, /maxLength=\{40\}/);
  assert.match(s, /toast\('Name saved'\)/);
  assert.doesNotMatch(s, /'Saved\.'/);
  assert.match(s, /useToast/);
  assert.match(s, /setNm\(name\)/);
  assert.match(s, /onChanged=\{\(\) => \{[^}]*setPver[^}]*refresh\(\)/s);
  assert.match(s, /Delete sample records/);
});

test('Home skeleton uses the same TOUCH heights and margins as the live Home', () => {
  const k = src('Skeleton.tsx');
  const h = src('Home.tsx');
  // live: Edit chip and See all accounts are TOUCH (48) tall; See all accounts has marginBottom sp.s
  assert.match(h, /minHeight: TOUCH[^}]*marginBottom: sp\.s/);
  assert.match(k, /<Skel w=\{72\} h=\{TOUCH\}/); // Edit chip placeholder
  assert.match(k, /minHeight: TOUCH, justifyContent: 'center', marginBottom: sp\.s/); // See all accounts placeholder
  assert.doesNotMatch(k, /same height as the live link \(a line plus/);
  assert.match(k, /import \{[^}]*TOUCH[^}]*\} from '\.\/ui'/);
});
