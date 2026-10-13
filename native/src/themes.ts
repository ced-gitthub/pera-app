// The colour palettes. This is the only file (besides uiTokens) that may hold hex codes. Pure (no react-native) so tests can check every palette.
// Meaning rule in every theme: up = money in, down = money out, warn/reward = amber, primary = the accent. Nothing else carries those meanings.
import type { Colors, StatusBarStyle, ThemeDef, ThemeId } from './themeLogic.ts';

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
// hsl (h 0-360, s/l 0-100) to #RRGGBB
export function hsl(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    return (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

type Seed = { h: number; s?: number; primary: string; up: string; down: string; warn?: string; reward?: string };

function dark(x: Seed): Colors {
  const { h, s = 40 } = x;
  const warn = x.warn ?? '#FFC247';
  const bg = hsl(h, s, 8);
  return {
    bg,
    card: hsl(h, s - 4, 14),
    raised: hsl(h, s - 6, 20),
    line: hsl(h, s - 10, 29),
    ink: hsl(h, 100, 96),
    mute: hsl(h, 22, 72),
    primary: x.primary,
    onPrimary: bg,
    up: x.up,
    down: x.down,
    warn,
    reward: x.reward ?? warn,
    onReward: bg,
    overlay: '#000000AA',
    dim: hsl(h, 100, 96) + '55',
    hero: {
      violet: hsl(h, 50, 22),
      teal: hsl(h + 160, 55, 17),
      plum: hsl(h + 290, 45, 21),
      navy: hsl(h + 215, 55, 21),
      amber: hsl(40, 62, 17),
    },
    scene: {
      bg: [hsl(h, 50, 13), hsl(h + 160, 55, 11), hsl(40, 62, 10)],
      blobA: [hsl(h, 100, 65), hsl(h + 160, 75, 45), hsl(40, 100, 64)],
      blobB: [hsl(h + 215, 100, 62), hsl(h + 130, 70, 56), hsl(28, 100, 62)],
      blobC: [hsl(h + 290, 100, 65), hsl(h + 185, 75, 40), hsl(48, 100, 74)],
    },
  };
}

function light(x: Seed): Colors {
  const { h } = x;
  const ink = hsl(h, 45, 10);
  return {
    bg: hsl(h, 35, 95),
    card: '#FFFFFF',
    raised: hsl(h, 30, 90),
    line: hsl(h, 20, 78),
    ink,
    mute: hsl(h, 14, 33),
    primary: x.primary,
    onPrimary: '#FFFFFF',
    up: x.up,
    down: x.down,
    warn: x.warn ?? '#8A5600',
    reward: x.reward ?? '#8A5600',
    onReward: '#FFFFFF',
    overlay: '#000000AA',
    dim: ink + '55',
    hero: {
      violet: hsl(h, 70, 88),
      teal: hsl(h + 160, 55, 85),
      plum: hsl(h + 290, 60, 89),
      navy: hsl(h + 215, 65, 88),
      amber: hsl(40, 85, 85),
    },
    scene: {
      bg: [hsl(h, 60, 92), hsl(h + 160, 55, 90), hsl(40, 80, 90)],
      blobA: [hsl(h, 90, 75), hsl(h + 160, 70, 65), hsl(40, 100, 70)],
      blobB: [hsl(h + 215, 90, 75), hsl(h + 130, 65, 66), hsl(28, 100, 72)],
      blobC: [hsl(h + 290, 90, 78), hsl(h + 185, 65, 60), hsl(48, 100, 76)],
    },
  };
}

const LIME: Colors = {
  bg: '#0E0B1A',
  card: '#1A1530',
  raised: '#241D42',
  line: '#33295C',
  ink: '#F2EFFF',
  mute: '#A59FC4',
  primary: '#B8F23A',
  onPrimary: '#0E0B1A',
  up: '#B8F23A',
  down: '#FF6B8E',
  warn: '#FFC247',
  reward: '#FFC247',
  onReward: '#0E0B1A',
  overlay: '#000000AA',
  dim: '#F2EFFF55',
  hero: { violet: '#2B1F66', teal: '#0F3D3A', plum: '#4A1F4D', navy: '#14275E', amber: '#4A3510' },
  scene: {
    bg: ['#140F30', '#0A2623', '#2B2008'],
    blobA: ['#7C4DFF', '#18C7A0', '#FFC247'],
    blobB: ['#3D7BFF', '#3DDC84', '#FF9E3D'],
    blobC: ['#B24DFF', '#1B9AAA', '#FFE27A'],
  },
};

const def = (id: ThemeId, name: string, blurb: string, colors: Colors, bar: StatusBarStyle = 'light-content'): ThemeDef => ({
  id,
  name,
  blurb,
  statusBarStyle: bar,
  colors,
});

export const THEMES: Record<ThemeId, ThemeDef> = {
  lime: def('lime', 'Lime Night', 'The original: violet night, lime glow', LIME),
  ocean: def('ocean', 'Ocean', 'Deep blue, bright aqua', dark({ h: 215, primary: '#4CC9F0', up: '#4ADE9A', down: '#FF6B8E' })),
  sunset: def(
    'sunset',
    'Sunset',
    'Warm dusk, tangerine accent',
    dark({ h: 12, primary: '#FF9F4A', up: '#7BE495', down: '#FF6B8E', warn: '#FFD23F' }),
  ),
  grape: def('grape', 'Grape', 'Rich purple, soft lilac', dark({ h: 275, primary: '#C58CFF', up: '#7BE495', down: '#FF6B8E' })),
  rose: def('rose', 'Rose', 'Berry night, bubblegum pink', dark({ h: 330, primary: '#FF7AB6', up: '#7BE495', down: '#FF9A5C' })),
  mint: def('mint', 'Mint', 'Forest dark, fresh mint', dark({ h: 165, primary: '#5EEAD4', up: '#8BE86B', down: '#FF8AA6' })),
  mono: def('mono', 'Mono', 'Quiet greys, no distractions', dark({ h: 240, s: 6, primary: '#E6E6EC', up: '#7BE495', down: '#FF6B8E' })),
  daylight: def(
    'daylight',
    'Daylight',
    'Light and clean for bright rooms',
    light({ h: 255, primary: '#5B3DF5', up: '#06683A', down: '#B01A42' }),
    'dark-content',
  ),
};

export const THEME_LIST: ThemeDef[] = Object.values(THEMES);

// Avatar background colours (ids are stored in the profile; see profileLogic.ts). Decorative only, never behind text.
export const AVATAR_COLORS: Record<string, string> = {
  violet: '#7C4DFF',
  lime: '#8FCB1E',
  coral: '#FF6B8E',
  amber: '#F5A524',
  teal: '#18B8A0',
  sky: '#3D9BFF',
  pink: '#E05AB8',
  slate: '#4B5578',
};
