import { createHash } from 'node:crypto';
// Password rules shared by sign-up, reset and change-password. bcrypt (Supabase) only uses the first 72 BYTES.
export const MIN_PW = 8, MAX_PW_BYTES = 72;
export const PWNED = 'That password has appeared in a data breach. Choose a different one.';
export function passwordProblem(p: string): string | null {
  const bytes = new TextEncoder().encode(p).length;
  if (bytes < MIN_PW || bytes > MAX_PW_BYTES) return `Use a password of ${MIN_PW} to ${MAX_PW_BYTES} characters.`;
  if (/^(.)\1+$/u.test(p)) return 'That password is too easy to guess. Mix different characters.';
  return null;
}
// Have I Been Pwned range API (k-anonymity: only the first 5 hex chars of the SHA-1 leave the server). Fails OPEN: if the service is slow or down, the password is accepted.
export async function isPwned(password: string, f: typeof fetch = fetch, timeoutMs = 2500): Promise<boolean> {
  try {
    const h = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase(), prefix = h.slice(0, 5), suffix = h.slice(5);
    const r = await f(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    if (!r.ok) return false;
    return (await r.text()).split('\n').some(line => { const [s, c] = line.trim().split(':'); return s === suffix && Number(c) > 0; });
  } catch { return false; }
}
export const isEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
// Where a verified code may send the user next (never an arbitrary URL).
const NEXT = new Set(['/', '/reset', '/security']);
export const safeNext = (s: string | null | undefined) => (s && NEXT.has(s) ? s : '/');
