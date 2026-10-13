// Pure helpers for the welcome screen's motion (no react-native here, so they are unit-tested). Nothing random: the same call gives the same result.
export type Flash = 'up' | 'down' | 'none';
export type Burst = 'none' | 'small' | 'big';
export type Particle = { emoji: string; dx: number; dy: number; rotate: number; delay: number; size: 's' | 'm' };

export const MAX_PARTICLES = 24;
const COINS = ['🪙', '✨', '💸', '🪙'];
const PARTY = ['🎉', '🪙', '✨', '🎊', '⭐', '🪙'];

// Money in flashes lime, money out flashes coral, no change does not flash.
export function flashDirection(prev: number, next: number): Flash {
  if (!Number.isFinite(prev) || !Number.isFinite(next) || prev === next) return 'none';
  return next > prev ? 'up' : 'down';
}

// A burst fires only when a mission was just completed (the step moved forward). Reaching mission 3 is the big one.
export function burstFor(prevStep: number, nextStep: number): Burst {
  if (nextStep <= prevStep) return 'none';
  return nextStep >= 3 ? 'big' : 'small';
}

// Particles fly out of the centre in an even ring; every second one is a little farther out and a little bigger.
export function burstParticles(kind: Burst, reduceMotion: boolean): Particle[] {
  if (kind === 'none' || reduceMotion) return [];
  const count = Math.min(MAX_PARTICLES, kind === 'big' ? 18 : 8);
  const pool = kind === 'big' ? PARTY : COINS;
  const reach = kind === 'big' ? 150 : 100;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // starts straight up
    const far = i % 2 === 0 ? 1 : 0.65;
    return {
      emoji: pool[i % pool.length],
      dx: Math.round(Math.cos(angle) * reach * far),
      dy: Math.round(Math.sin(angle) * reach * far) - (kind === 'big' ? 30 : 20), // a little upward bias
      rotate: ((i * 47) % 120) - 60,
      delay: (i % 4) * 40,
      size: i % 2 === 0 ? ('m' as const) : ('s' as const),
    };
  });
}

// Delay for the nth item of a staggered entrance (0 with reduced motion, never negative).
export function staggerDelay(index: number, reduceMotion: boolean, stepMs = 90): number {
  if (reduceMotion || index <= 0) return 0;
  return index * stepMs;
}

// A duration, or 0 when the person asked for reduced motion.
export const dur = (base: number, reduceMotion: boolean) => (reduceMotion ? 0 : base);

// Progress dots: mission n of 3 has n dots filled (mission 3 = all done).
export const dotsFilled = (step: 1 | 2 | 3): number => step;
