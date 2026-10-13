import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THEME_IDS, DEFAULT_THEME, isThemeId, resolveThemeId, contrast, paletteProblems } from '../native/src/themeLogic.ts';
import { THEMES, THEME_LIST } from '../native/src/themes.ts';
import { c, applyPalette, themeState } from '../native/src/uiTokens.ts';

test('themes: ids, fallback and count', () => {
  assert.ok(THEME_IDS.length >= 8);
  assert.equal(DEFAULT_THEME, 'lime');
  assert.ok(isThemeId('ocean') && !isThemeId('nope') && !isThemeId(undefined));
  assert.equal(resolveThemeId('nope'), 'lime');
  assert.equal(resolveThemeId(42), 'lime');
  assert.equal(resolveThemeId('grape'), 'grape');
  assert.equal(THEME_LIST.length, THEME_IDS.length);
});

test('themes: contrast helper', () => {
  assert.ok(Math.abs(contrast('#000000', '#FFFFFF') - 21) < 0.01);
  assert.ok(Math.abs(contrast('#777777', '#777777') - 1) < 0.001);
});

test('themes: validation catches bad palettes', () => {
  const good = structuredClone(THEMES.lime.colors);
  assert.deepEqual(paletteProblems(good), []);
  assert.ok(paletteProblems({ ...good, mute: '#1A1530' }).length > 0);
  assert.ok(paletteProblems({ ...good, ink: 'white' })[0].includes('ink'));
  assert.ok(paletteProblems({ ...good, scene: { ...good.scene, bg: ['#000000'] } }).length > 0);
});

for (const id of THEME_IDS) {
  test(`themes: ${id} is readable (every text/background pair >= 4.5:1)`, () => {
    const t = THEMES[id];
    assert.equal(t.id, id);
    assert.deepEqual(paletteProblems(t.colors), []);
    const { bg, card, raised } = t.colors;
    if (t.statusBarStyle === 'light-content') {
      const L = (h: string) => contrast(h, '#000000');
      assert.ok(L(bg) < L(card) && L(card) < L(raised), 'dark surfaces get lighter as they rise');
    } else assert.notEqual(card, bg);
  });
}

test('themes: exactly one light theme and it uses dark status bar content', () => {
  const light = THEME_LIST.filter((t) => t.statusBarStyle === 'dark-content');
  assert.deepEqual(
    light.map((t) => t.id),
    ['daylight'],
  );
});

test('themes: applyPalette changes c in place and falls back on unknown ids', () => {
  const same = c;
  const hero = c.hero;
  applyPalette('daylight');
  assert.equal(c, same);
  assert.equal(c.hero, hero);
  assert.equal(c.bg, THEMES.daylight.colors.bg);
  assert.equal(hero.violet, THEMES.daylight.colors.hero.violet);
  assert.equal(themeState.statusBarStyle, 'dark-content');
  applyPalette('definitely-not-a-theme');
  assert.equal(themeState.id, 'lime');
  assert.equal(c.bg, THEMES.lime.colors.bg);
  assert.equal(themeState.statusBarStyle, 'light-content');
});

test('themes: money meaning stays — up and down differ from each other and from warn in every theme', () => {
  for (const t of THEME_LIST) {
    const k = t.colors;
    assert.notEqual(k.up, k.down, t.id);
    assert.notEqual(k.down, k.warn, t.id);
    assert.notEqual(k.up, k.warn, t.id);
  }
});

test('themes: screens never hold hex colours (only the palette files may)', () => {
  const allowed = new Set(['themes.ts', 'uiTokens.ts', 'ui.ts']);
  for (const f of fs.readdirSync('native/src').filter((f) => /\.tsx?$/.test(f) && !allowed.has(f)))
    assert.ok(!/['"]#[0-9a-fA-F]{3,8}['"]/.test(fs.readFileSync(`native/src/${f}`, 'utf8').replace(/\/\/.*$/gm, '')), f);
});

import { shouldAdoptTheme } from '../native/src/themeLogic.ts';
test('a theme saved on another phone is adopted only at sign-in, never mid-use (token refreshes must not remount the screen)', () => {
  assert.equal(shouldAdoptTheme('SIGNED_IN'), true);
  assert.equal(shouldAdoptTheme('INITIAL_SESSION'), true);
  for (const ev of ['TOKEN_REFRESHED', 'USER_UPDATED', 'SIGNED_OUT', 'PASSWORD_RECOVERY', 'MFA_CHALLENGE_VERIFIED'])
    assert.equal(shouldAdoptTheme(ev), false, ev);
});
