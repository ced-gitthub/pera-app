import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The native app's look lives in native/src/ui.ts (colors c, spacing sp, type t, emoji e, radius r). Screens use those tokens and never raw numbers or hex codes,
// so the whole app can be re-themed in one file and nothing drifts.
const DIR = 'native/src';
const files = fs.readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !['ui.ts', 'uiTokens.ts', 'themes.ts'].includes(f));
const code = (f: string) =>
  fs
    .readFileSync(`${DIR}/${f}`, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')); // comments may mention numbers

const offenders = (re: RegExp) =>
  files.flatMap((f) => code(f).flatMap((l, i) => (re.test(l) ? [`${f}:${i + 1}: ${l.trim().slice(0, 70)}`] : [])));

test('design: no raw hex colors outside the palette files (themes.ts, uiTokens.ts)', () => {
  assert.deepEqual(offenders(/['"]#[0-9a-fA-F]{3,8}['"]/), []);
});

test('design: font sizes come from the type scale', () => {
  assert.deepEqual(offenders(/fontSize:\s*\d/), []);
});

test('design: radii come from the radius scale', () => {
  assert.deepEqual(offenders(/[Rr]adius:\s*\d/), []);
});

test('design: padding, margin and gap come from the spacing scale (0 is allowed)', () => {
  assert.deepEqual(offenders(/\b(?:padding|margin|gap)\w*:\s*[^,}]*\b[1-9]\d*\b/), []);
});

test('design: the tokens exist', () => {
  const ui = fs.readFileSync(`${DIR}/uiTokens.ts`, 'utf8');
  for (const name of ['export const c =', 'export const sp =', 'export const t =', 'export const e =', 'export const r ='])
    assert.ok(ui.includes(name), name);
});

test('design: every scale is ascending', async () => {
  const { sp, t, e, r } = await import('../native/src/uiTokens.ts');
  for (const [name, scale] of Object.entries({ sp, t, e, r })) {
    const v = Object.values(scale);
    assert.deepEqual(
      v,
      [...v].sort((a, b) => a - b),
      name,
    );
  }
});

test('design: every theme palette is readable (every text/background pair >= 4.5:1, hero tints, surfaces ordered)', async () => {
  const { THEME_LIST } = await import('../native/src/themes.ts');
  const { paletteProblems, luminance } = await import('../native/src/themeLogic.ts');
  for (const th of THEME_LIST) {
    assert.deepEqual(paletteProblems(th.colors), [], th.id);
    const { bg, card, raised } = th.colors;
    if (th.statusBarStyle === 'light-content')
      assert.ok(luminance(bg) < luminance(card) && luminance(card) < luminance(raised), th.id + ': surfaces get lighter as they rise');
  }
});

test('design: the live c object matches the default palette and can be re-themed in place', async () => {
  const { c, applyPalette } = await import('../native/src/uiTokens.ts');
  const { THEMES } = await import('../native/src/themes.ts');
  assert.equal(c.bg, THEMES.lime.colors.bg);
  const ref = c.hero;
  applyPalette('ocean');
  assert.equal(c.hero, ref);
  assert.equal(c.primary, THEMES.ocean.colors.primary);
  applyPalette('lime');
});

test('safety: logging out always asks first (only signout.ts may call signOut)', () => {
  const callers = fs
    .readdirSync(DIR)
    .filter((f) => /\.tsx?$/.test(f) && f !== 'signout.ts')
    .filter((f) => /auth\.signOut\(/.test(fs.readFileSync(`${DIR}/${f}`, 'utf8')));
  assert.deepEqual(callers, []);
  const helper = fs.readFileSync(`${DIR}/signout.ts`, 'utf8');
  assert.match(helper, /Alert\.alert\(/);
  assert.match(helper, /style: 'cancel'/); // there is a clear way to back out
});

test('design: absolute positions (top, left, right, bottom) come from tokens or insets, not raw numbers', () => {
  assert.deepEqual(offenders(/\b(?:top|left|right|bottom)\s*:\s*[1-9]\d*\b/), []);
});
