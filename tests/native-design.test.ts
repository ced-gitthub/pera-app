import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The native app's look lives in native/src/ui.ts (colors c, spacing sp, type t, emoji e, radius r). Screens use those tokens and never raw numbers or hex codes,
// so the whole app can be re-themed in one file and nothing drifts.
const DIR = 'native/src';
const files = fs.readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && f !== 'ui.ts' && f !== 'uiTokens.ts');
const code = (f: string) =>
  fs
    .readFileSync(`${DIR}/${f}`, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')); // comments may mention numbers

const offenders = (re: RegExp) =>
  files.flatMap((f) => code(f).flatMap((l, i) => (re.test(l) ? [`${f}:${i + 1}: ${l.trim().slice(0, 70)}`] : [])));

test('design: no raw hex colors outside ui.ts', () => {
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

test('design: the dark palette is readable (every text/background pair >= 4.5:1)', async () => {
  const { c } = await import('../native/src/uiTokens.ts');
  const lum = (hex: string) => {
    const n = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const surfaces = { bg: c.bg, card: c.card, raised: c.raised };
  for (const [sn, s] of Object.entries(surfaces))
    for (const tn of ['ink', 'mute', 'up', 'down', 'warn'] as const) assert.ok(ratio(c[tn], s) >= 4.5, tn + ' on ' + sn);
  assert.ok(ratio(c.onPrimary, c.primary) >= 4.5, 'text on the primary button');
  assert.ok(ratio(c.onReward, c.reward) >= 4.5, 'text on the reward chip');
  for (const [name, bg] of Object.entries(c.hero)) assert.ok(ratio(c.ink, bg as string) >= 4.5, 'hero ' + name);
  assert.ok(lum(c.bg) < lum(c.card) && lum(c.card) < lum(c.raised), 'surfaces get lighter as they rise');
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
