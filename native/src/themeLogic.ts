// Pure theme rules (no react-native): ids, fallback, palette shape and contrast checks. The colours themselves live in themes.ts.
export const THEME_IDS = ['lime', 'ocean', 'sunset', 'grape', 'rose', 'mint', 'mono', 'daylight'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'lime';
export const THEME_KEY = 'zv_theme';

export const isThemeId = (x: unknown): x is ThemeId => typeof x === 'string' && (THEME_IDS as readonly string[]).includes(x);
// Anything unknown (old app version, tampered storage) falls back to the default look instead of crashing.
export const resolveThemeId = (x: unknown): ThemeId => (isThemeId(x) ? x : DEFAULT_THEME);

export type StatusBarStyle = 'light-content' | 'dark-content';
export type Colors = {
  bg: string;
  card: string;
  raised: string;
  line: string;
  ink: string;
  mute: string;
  primary: string;
  onPrimary: string;
  up: string;
  down: string;
  warn: string;
  reward: string;
  onReward: string;
  overlay: string;
  dim: string;
  hero: { violet: string; teal: string; plum: string; navy: string; amber: string };
  scene: { bg: string[]; blobA: string[]; blobB: string[]; blobC: string[] };
};
export type ThemeDef = { id: ThemeId; name: string; blurb: string; statusBarStyle: StatusBarStyle; colors: Colors };

const HEX6 = /^#[0-9a-fA-F]{6}$/;
export const isHex6 = (x: unknown): x is string => typeof x === 'string' && HEX6.test(x);

const lum = (hex: string) => {
  const n = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
};
export const luminance = lum;
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Every problem with a palette, as readable strings; an empty list means it is valid and readable (>= 4.5:1 for every text pair).
export function paletteProblems(c: Colors): string[] {
  const out: string[] = [];
  const plain = [
    'bg',
    'card',
    'raised',
    'line',
    'ink',
    'mute',
    'primary',
    'onPrimary',
    'up',
    'down',
    'warn',
    'reward',
    'onReward',
  ] as const;
  for (const k of plain) if (!isHex6(c[k])) out.push(`${k} is not #RRGGBB`);
  for (const [k, v] of Object.entries(c.hero)) if (!isHex6(v)) out.push(`hero.${k} is not #RRGGBB`);
  for (const k of ['bg', 'blobA', 'blobB', 'blobC'] as const)
    if (c.scene[k].length !== 3 || !c.scene[k].every(isHex6)) out.push(`scene.${k} needs 3 colours`);
  if (out.length) return out;
  const need = (fg: string, bg: string, what: string) => {
    if (contrast(fg, bg) < 4.5) out.push(`${what} is below 4.5:1`);
  };
  for (const sn of ['bg', 'card', 'raised'] as const)
    for (const tn of ['ink', 'mute', 'primary', 'up', 'down', 'warn', 'reward'] as const) need(c[tn], c[sn], `${tn} on ${sn}`);
  need(c.onPrimary, c.primary, 'onPrimary on primary');
  need(c.onReward, c.reward, 'onReward on reward');
  for (const [k, v] of Object.entries(c.hero)) need(c.ink, v, `ink on hero.${k}`);
  return out;
}

// A theme saved on another phone is adopted when this phone signs in, never in the middle of use: a token refresh must not remount the whole screen.
export const shouldAdoptTheme = (authEvent: string): boolean => authEvent === 'SIGNED_IN' || authEvent === 'INITIAL_SESSION';
