// Every colour, space, text size, emoji size and corner radius in the app. Screens use these names, never raw numbers (tests/native-design.test.ts enforces it).
// Rule (same as the website): purple = progress and primary actions, yellow = rewards and anything sitting on purple.
export const c = {
  bg: '#F7F5FF',
  card: '#FFFFFF',
  white: '#FFFFFF',
  ink: '#1B1033',
  mute: '#6B6486',
  purple: '#5B2EE0',
  yellow: '#FFD23F',
  red: '#C62828',
  green: '#167A41',
  line: '#E4DEF7',
  glass: '#FFFFFFEE', // white card laid over a coloured hero
  dim: '#FFFFFF77', // inactive dot on a coloured background
  // hero backgrounds for white text: each one passes 4.5:1
  hero: { purple: '#5B2EE0', violet: '#7A4DF0', indigo: '#3D2AB5', green: '#167A41', orange: '#B83A0A', gold: '#8A6500' },
};
export const sp = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const t = { caption: 13, body: 16, lead: 18, title: 22, head: 28, display: 34 };
export const e = { s: 44, m: 64, l: 84 }; // emoji sizes
export const r = { s: 12, m: 18, l: 28, pill: 999 };
