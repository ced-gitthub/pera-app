// The phone's "seen the intro" markers vanish on a reinstall, so the account itself remembers: a marker in the sign-in profile (free, no table),
// and any account more than a day old is never pushed through the first-run steps again.
export const INTRO_MARKER = 'zv_intro_done';
export const OLD_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export function isIntroDone(x: { meta?: Record<string, unknown> | null; createdAt?: string | null; now: number }): boolean {
  if (x.meta?.[INTRO_MARKER] === true) return true;
  const made = x.createdAt ? Date.parse(x.createdAt) : NaN;
  return Number.isFinite(made) && x.now - made > OLD_ACCOUNT_MS;
}
