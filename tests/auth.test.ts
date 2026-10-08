import test from 'node:test'; import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { passwordProblem, isPwned, isEmail, safeNext, PWNED } from '../src/lib/password.ts';
import { authMessage, GENERIC } from '../src/lib/safe.ts';
const sha = (p: string) => createHash('sha1').update(p).digest('hex').toUpperCase();
const range = (lines: Record<string, number>, seen?: string[]) => (async (url: string | URL | Request) => { const u = String(url); seen?.push(u); const pre = u.split('/range/')[1]; return new Response(Object.entries(lines).filter(([h]) => h.startsWith(pre)).map(([h, c]) => `${h.slice(5)}:${c}`).join('\r\n'), { status: 200 }); }) as typeof fetch;
test('password policy', () => {
  assert.equal(passwordProblem('longenough1'), null); assert.equal(passwordProblem('12345678'), null);
  for (const bad of ['', 'short', '1234567', 'a'.repeat(73), '😀'.repeat(19), 'aaaaaaaa', '        ']) assert.ok(passwordProblem(bad), JSON.stringify(bad));
  assert.equal(passwordProblem('ab'.repeat(36)), null); assert.equal(passwordProblem('😀😃'.repeat(9)), null); // 72 bytes exactly
});
test('breached-password check uses k-anonymity and fails open', async () => {
  const seen: string[] = [], f = range({ [sha('password123')]: 90000 }, seen);
  assert.equal(await isPwned('password123', f), true); assert.equal(await isPwned('a-very-unusual-passphrase-7731', f), false);
  assert.ok(seen.every(u => /\/range\/[0-9A-F]{5}$/.test(u)), 'only a 5-char hash prefix is sent'); assert.ok(!seen.some(u => u.includes('password123')));
  assert.equal(await isPwned('password123', (async () => { throw new Error('offline'); }) as unknown as typeof fetch), false, 'network error');
  assert.equal(await isPwned('password123', (async () => new Response('x', { status: 503 })) as unknown as typeof fetch), false, 'service error');
  assert.equal(await isPwned('password123', range({ [sha('password123')]: 0 })), false, 'padding rows (count 0) are not matches');
  assert.ok(PWNED.length > 10);
});
test('email + next helpers', () => {
  for (const ok of ['a@b.co', 'a.b+c@sub.example.ph']) assert.ok(isEmail(ok)); for (const bad of ['', 'a', 'a@b', 'a b@c.d', 'a@b.c d', 'x'.repeat(250) + '@b.co']) assert.ok(!isEmail(bad), bad);
  assert.equal(safeNext('/reset'), '/reset'); assert.equal(safeNext('/security'), '/security'); for (const bad of ['https://evil.test', '//evil.test', '/transactions', '', null, undefined, '/reset?x=1']) assert.equal(safeNext(bad as string), '/');
});
test('two-step + email-confirmation errors map to safe sentences', () => {
  assert.match(authMessage({ code: 'mfa_verification_failed' }), /code is not right/); assert.match(authMessage({ message: 'Invalid TOTP code entered' }), /code is not right/);
  assert.match(authMessage({ code: 'email_not_confirmed' }), /Confirm your email/); assert.match(authMessage({ code: 'weak_password' }), /8 characters/);
  assert.equal(authMessage({ code: 'something_new', message: 'secret internal text' }, 't'), GENERIC);
});
import { newCode, hashCode, sameHash, maskEmail, nextSend, checkCode, cooldownPassed, CODE_TTL_MS, MAX_ATTEMPTS, MAX_SENDS, SEND_WINDOW_MS, RECOVERY_COOLDOWN_MS, type Row } from '../src/lib/backupcode.ts';
const row = (o: Partial<Row> = {}): Row => ({ user_id: 'u1', email: 'b@x.com', verified_at: null, code_hash: hashCode('u1', '123456'), code_expires_at: new Date(1_000_000 + CODE_TTL_MS).toISOString(), code_attempts: 0, sends_in_hour: 1, sends_window_start: new Date(1_000_000).toISOString(), last_recovery_at: null, ...o });
test('backup codes: 6 digits, hashed per user, constant-time compare', () => {
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^\d{6}$/);
  assert.notEqual(hashCode('u1', '123456'), hashCode('u2', '123456')); assert.notEqual(hashCode('u1', '123456'), hashCode('u1', '123457'));
  assert.ok(sameHash(hashCode('u1', '1'), hashCode('u1', '1'))); assert.ok(!sameHash(hashCode('u1', '1'), hashCode('u1', '2'))); assert.ok(!sameHash('', '')); assert.ok(!sameHash('ab', 'abcd'));
});
test('backup codes: check outcomes', () => {
  const now = 1_000_000;
  assert.equal(checkCode(row(), 'u1', '123456', now), 'ok'); assert.equal(checkCode(row(), 'u1', '000000', now), 'wrong'); assert.equal(checkCode(row(), 'u2', '123456', now), 'wrong', 'bound to the user');
  assert.equal(checkCode(row(), 'u1', '123456', now + CODE_TTL_MS + 1), 'expired'); assert.equal(checkCode(row({ code_attempts: MAX_ATTEMPTS }), 'u1', '123456', now), 'locked', 'locked even with the right code');
  assert.equal(checkCode(null, 'u1', '123456', now), 'none'); assert.equal(checkCode(row({ code_hash: null }), 'u1', '123456', now), 'none');
});
test('backup codes: send limit and recovery cooldown', () => {
  const t = 5_000_000; assert.deepEqual(nextSend(null, t), { ok: true, sends: 1, start: new Date(t).toISOString() });
  const full = row({ sends_in_hour: MAX_SENDS, sends_window_start: new Date(t).toISOString() });
  assert.equal(nextSend(full, t + 1000).ok, false); assert.equal(nextSend(full, t + SEND_WINDOW_MS).ok, true, 'window rolled over'); assert.equal(nextSend(full, t + SEND_WINDOW_MS).sends, 1);
  assert.equal(nextSend(row({ sends_in_hour: 2, sends_window_start: new Date(t).toISOString() }), t + 10).sends, 3);
  assert.ok(cooldownPassed({ last_recovery_at: null }, t)); const l = new Date(t).toISOString();
  assert.ok(!cooldownPassed({ last_recovery_at: l }, t + RECOVERY_COOLDOWN_MS - 1)); assert.ok(cooldownPassed({ last_recovery_at: l }, t + RECOVERY_COOLDOWN_MS));
});
test('backup email is masked', () => { assert.equal(maskEmail('maria@gmail.com'), 'm••••@gmail.com'); assert.equal(maskEmail('ab@x.co'), 'a•@x.co'); assert.ok(!maskEmail('verylongname@x.co').includes('verylong')); });
