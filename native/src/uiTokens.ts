// Every colour, space, text size, emoji size and corner radius in the app. Screens use these names, never raw numbers (tests/native-design.test.ts enforces it).
// Dark-first. Meaning rules: lime = money in and primary actions; coral = money out; amber = near a limit and rewards. Nothing else carries those meanings.
export const c = {
  bg: '#0E0B1A',
  card: '#1A1530',
  raised: '#241D42',
  line: '#33295C',
  ink: '#F2EFFF',
  mute: '#A59FC4',
  primary: '#B8F23A',
  onPrimary: '#0E0B1A',
  up: '#B8F23A', // money in, success
  down: '#FF6B8E', // money out, errors
  warn: '#FFC247', // close to a limit
  reward: '#FFC247', // XP, streak, level
  onReward: '#0E0B1A',
  overlay: '#000000AA',
  dim: '#F2EFFF55', // inactive dot
  // tinted surfaces for page banners; light text (ink) sits on top of them
  hero: { violet: '#2B1F66', teal: '#0F3D3A', plum: '#4A1F4D', navy: '#14275E', amber: '#4A3510' },
};
export const sp = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, clear: 120 }; // clear = room under a list for the floating Add button
export const t = { caption: 13, body: 16, lead: 18, title: 22, head: 28, display: 40 };
export const e = { s: 44, m: 64, l: 84 }; // emoji sizes
export const r = { s: 12, m: 18, l: 28, pill: 999 };
