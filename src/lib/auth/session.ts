// True when the user signed in within the last `maxMs` (default 10 minutes). Used to protect sensitive actions for accounts without a password (Google sign-in).
export const recentSignIn = (lastSignInAt: string | null | undefined, now = Date.now(), maxMs = 10 * 60_000): boolean => {
  const t = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  return Number.isFinite(t) && now - t >= -60_000 && now - t <= maxMs;
};

// When THIS session was authenticated, read from the access token's "amr" list (it survives token refreshes). Tying the check to the session, not the
// account's last sign-in on any device, stops a stolen old session from deleting an account just because the owner signed in elsewhere.
export function sessionSignInAt(accessToken: string | null | undefined): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from((accessToken ?? '').split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      amr?: { timestamp?: number }[];
    };
    const secs = (payload.amr ?? []).map((a) => Number(a?.timestamp)).filter(Number.isFinite);
    return secs.length ? new Date(Math.max(...secs) * 1000).toISOString() : undefined;
  } catch {
    return undefined;
  }
}
