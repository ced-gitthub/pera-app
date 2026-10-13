// A brand-new in-app account must start EMPTY: the hands-on tutorial before sign-up is the sample, so nothing left over should confuse the first real entries.
// Safety: this only ever runs right after a sign-up on THIS phone (a flag set by the sign-up screen) and only for an account created in the last day,
// so signing in to an existing account can never wipe anything.
export const JUST_SIGNED_UP_KEY = 'zv_just_signed_up';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function shouldCleanNewAccount(justSignedUp: boolean, createdAt: string | undefined, now: number): boolean {
  if (!justSignedUp || !createdAt) return false;
  const made = Date.parse(createdAt);
  if (!Number.isFinite(made)) return false;
  return now - made >= 0 && now - made < ONE_DAY_MS;
}
