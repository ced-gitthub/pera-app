// True when the user signed in within the last `maxMs` (default 10 minutes). Used to protect sensitive actions for accounts without a password (Google sign-in).
export const recentSignIn = (lastSignInAt: string | null | undefined, now = Date.now(), maxMs = 10 * 60_000): boolean => {
  const t = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  return Number.isFinite(t) && now - t >= -60_000 && now - t <= maxMs;
};
