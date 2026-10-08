// Never show raw database / Supabase / stack text to users. Log a redacted copy on the server, return a safe sentence.
export class UserError extends Error {}
export const GENERIC = 'Something went wrong. Please try again.';
const BY_CODE: Record<string, string> = {
  '23505': 'That already exists.', '23503': 'That item is still in use.', '23514': 'Some of those values are not allowed.', '23502': 'A required value is missing.',
  '22P02': 'Some of those values are not valid.', '42501': 'You do not have permission to do that.', 'PGRST116': 'That item was not found.',
};
const AUTH: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.', user_already_exists: 'An account with this email already exists. Try logging in.', email_exists: 'An account with this email already exists. Try logging in.',
  weak_password: 'That password is too weak. Use at least 6 characters.', email_address_invalid: 'Enter a valid email address.', validation_failed: 'Enter a valid email address and a password of at least 6 characters.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.', over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes and try again.',
  email_not_confirmed: 'Confirm your email first, then sign in.', signup_disabled: 'Sign-ups are turned off.', same_password: 'Choose a password different from your current one.',
  otp_expired: 'That link has expired. Request a new one.', flow_state_not_found: 'That link is no longer valid. Request a new one.', bad_code_verifier: 'That link is no longer valid. Request a new one.',
};
export const redact = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g, '[jwt]').replace(/\b(sb_(?:publishable|secret)_|sk-)[\w-]+/g, '[key]').replace(/[A-Za-z0-9_-]{40,}/g, '[token]').slice(0, 500);
export function logErr(where: string, e: unknown) {
  const x = e as { message?: string; code?: string; status?: number } | null;
  console.error(`[pera] ${where}:`, redact(String(x?.message ?? e)), x?.code ?? '', x?.status ?? '');
}
export function safeMessage(e: unknown, where = 'action'): string {
  if (e instanceof UserError) return e.message;
  logErr(where, e); const code = (e as { code?: string } | null)?.code;
  return (code && BY_CODE[code]) || GENERIC;
}
export function authMessage(e: unknown, where = 'auth'): string {
  const code = (e as { code?: string } | null)?.code ?? ''; if (AUTH[code]) return AUTH[code];
  const msg = String((e as { message?: string } | null)?.message ?? ''); if (/invalid login credentials/i.test(msg)) return AUTH.invalid_credentials;
  logErr(where, e); return GENERIC;
}
export function dbError(e: unknown, where = 'query'): never { logErr(where, e); throw new UserError(GENERIC); }
