// Pure helpers for the welcome screen's living backdrop, header and level badge (no react-native here, so they are unit-tested). Nothing random.
import { c } from './uiTokens.ts';
import { levelInfo } from '../../src/lib/progress/quests.ts';

export type Step = 1 | 2 | 3;
export const MAX_FLOATERS = 10;
const XP_PER_ENTRY = 5;
const MISSION_BONUS = [0, 50, 100]; // extra XP for each finished mission (mission 1 done = 50)
const MAX_XP_ENTRIES = 12; // the sandbox allows at most 12 lines

// mission 1 = cool violet (0), mission 2 = mint (1), mission 3 = gold (2)
export const moodIndex = (step: Step): number => step - 1;

export function sceneStops() {
  return { inputRange: [0, 1, 2], bg: c.scene.bg, blobs: [c.scene.blobA, c.scene.blobB, c.scene.blobC] };
}

const HEADLINES = { 1: 'Type a line. See what is left.', 2: 'Pay yourself first.', 3: 'You are in control.' } as const;
export const headlineFor = (step: Step) => HEADLINES[step];

// How much of the top progress track is filled: a third per mission reached (never empty, full at the end).
export const progressFraction = (step: Step): number => step / 3;

export function sandboxXp(step: Step, entries: number): number {
  const done = step - 1; // missions finished
  return (MISSION_BONUS[done] ?? 0) + Math.min(Math.max(0, Math.floor(entries)), MAX_XP_ENTRIES) * XP_PER_ENTRY;
}
export const xpGain = (prevStep: Step, prevEntries: number, nextStep: Step, nextEntries: number): number =>
  Math.max(0, sandboxXp(nextStep, nextEntries) - sandboxXp(prevStep, prevEntries));

// The level chip appears once mission 1 is done (step 2 or later).
export function badgeFor(step: Step, entries: number) {
  if (step < 2) return null;
  const xp = sandboxXp(step, entries);
  const info = levelInfo(xp);
  return { level: info.level, title: info.title, emoji: info.emoji, xp, pct: info.pct, toNext: info.toNext };
}

export type Floater = { emoji: string; leftPct: number; size: 's' | 'm'; duration: number; delay: number; drift: number };
const EMOJI = [
  ['🪙', '✨', '🪙', '💸', '✨', '🪙', '✨', '🪙', '💸', '✨'],
  ['🌱', '🪙', '💚', '🐷', '🪙', '🌱', '🪙', '💚', '🐷', '🪙'],
  ['🪙', '⭐', '🎉', '🪙', '✨', '🏆', '🪙', '⭐', '🎊', '✨'],
];
const COUNT = [6, 8, 10];

// Coins and peso-ish emoji that rise and fade. Positions are spread evenly with a fixed shuffle; mood 3 has the most.
export function floatersFor(mood: number, reduceMotion: boolean): Floater[] {
  if (reduceMotion) return [];
  const m = Math.min(2, Math.max(0, Math.floor(mood)));
  const n = Math.min(MAX_FLOATERS, COUNT[m]);
  return Array.from({ length: n }, (_, i) => ({
    emoji: EMOJI[m][i % EMOJI[m].length],
    leftPct: Math.round(((i * 7 + 2) % n) * (92 / Math.max(1, n - 1)) + 2),
    size: i % 3 === 0 ? ('m' as const) : ('s' as const),
    duration: 7000 + ((i * 1300) % 5000),
    delay: (i * 900) % 6000,
    drift: (i % 2 === 0 ? 1 : -1) * (12 + ((i * 5) % 20)),
  }));
}

// 0 = violet, 1 = teal. Starts around the starter share and moves as Savings grows. Clamped.
export function heroTint(share: number): number {
  if (!Number.isFinite(share)) return 0;
  return Math.min(1, Math.max(0, (share - 0.4) / 0.4));
}

// Farther layers move less; scrolling up past the top (bounce) does not move them.
export function parallaxShift(scrollY: number, depth: number): number {
  if (!Number.isFinite(scrollY) || scrollY <= 0) return 0;
  const v = -Math.round(scrollY * depth);
  return Math.max(-200, v) + 0;
}
