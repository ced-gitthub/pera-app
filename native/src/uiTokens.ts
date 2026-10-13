// Every colour, space, text size, emoji size and corner radius in the app. Screens use these names, never raw numbers (tests/native-design.test.ts enforces it).
// Colours come from the active palette in themes.ts. `c` is ONE object whose values are replaced in place by applyPalette(), so `c.x` always reads the current theme.
// Meaning rules (every theme): up = money in and success; down = money out and errors; amber = near a limit and rewards; primary = the accent.
import type { Colors, StatusBarStyle, ThemeId } from './themeLogic.ts';
import { DEFAULT_THEME, resolveThemeId } from './themeLogic.ts';
import { THEMES } from './themes.ts';

const copy = (k: Colors): Colors => ({
  ...k,
  hero: { ...k.hero },
  scene: { bg: [...k.scene.bg], blobA: [...k.scene.blobA], blobB: [...k.scene.blobB], blobC: [...k.scene.blobC] },
});

export const c = copy(THEMES[DEFAULT_THEME].colors);
export const themeState: { id: ThemeId; statusBarStyle: StatusBarStyle } = {
  id: DEFAULT_THEME,
  statusBarStyle: THEMES[DEFAULT_THEME].statusBarStyle,
};

// Replace every colour in `c` (and its nested objects) in place. Unknown ids fall back to the default theme.
export function applyPalette(id: unknown): ThemeId {
  const theme = THEMES[resolveThemeId(id)];
  const k = copy(theme.colors);
  Object.assign(c, k, { hero: c.hero, scene: c.scene });
  Object.assign(c.hero, k.hero);
  Object.assign(c.scene, k.scene);
  themeState.id = theme.id;
  themeState.statusBarStyle = theme.statusBarStyle;
  return theme.id;
}

export const sp = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, clear: 120 }; // clear = room under a list for the floating Add button
export const t = { caption: 13, body: 16, lead: 18, title: 22, head: 28, display: 40 };
export const e = { s: 44, m: 64, l: 84 }; // emoji sizes
export const r = { s: 12, m: 18, l: 28, pill: 999 };
