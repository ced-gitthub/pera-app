import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
// Pure helpers for the backup-email flow (no I/O, no aliases, so they run in plain node tests).
export const CODE_TTL_MS = 10 * 60_000, MAX_ATTEMPTS = 5, MAX_SENDS = 5, SEND_WINDOW_MS = 3_600_000, RECOVERY_COOLDOWN_MS = 60_000;
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const hashCode = (userId: string, code: string) => createHash('sha256').update(`pera-backup:${userId}:${code}`).digest('hex');
export const sameHash = (a: string, b: string) => { const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex'); return x.length > 0 && x.length === y.length && timingSafeEqual(x, y); };
export const maskEmail = (e: string) => { const [u = '', d = ''] = e.split('@'); return `${u.slice(0, 1)}${'•'.repeat(Math.max(1, Math.min(6, u.length - 1)))}@${d}`; };
export type Row = { user_id: string; email: string | null; verified_at: string | null; code_hash: string | null; code_expires_at: string | null; code_attempts: number; sends_in_hour: number; sends_window_start: string | null; last_recovery_at: string | null };
// At most MAX_SENDS codes per rolling hour per account.
export function nextSend(row: Pick<Row, 'sends_in_hour' | 'sends_window_start'> | null, now: number): { ok: boolean; sends: number; start: string } {
  const t = row?.sends_window_start ? Date.parse(row.sends_window_start) : 0, fresh = !row || !t || now - t >= SEND_WINDOW_MS, sends = fresh ? 0 : row!.sends_in_hour;
  return { ok: sends < MAX_SENDS, sends: sends + 1, start: new Date(fresh ? now : t).toISOString() };
}
export type Check = 'ok' | 'none' | 'expired' | 'locked' | 'wrong';
export function checkCode(row: Row | null, userId: string, code: string, now: number): Check {
  if (!row?.code_hash || !row.code_expires_at) return 'none'; if (row.code_attempts >= MAX_ATTEMPTS) return 'locked'; if (Date.parse(row.code_expires_at) < now) return 'expired';
  return sameHash(row.code_hash, hashCode(userId, code)) ? 'ok' : 'wrong';
}
export const cooldownPassed = (row: Pick<Row, 'last_recovery_at'>, now: number) => !row.last_recovery_at || now - Date.parse(row.last_recovery_at) >= RECOVERY_COOLDOWN_MS;
