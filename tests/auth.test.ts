import test from 'node:test'; import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { passwordProblem, isPwned, isEmail, safeNext, PWNED } from '../src/lib/password.ts';
import { authMessage, GENERIC } from '../src/lib/safe.ts';
const sha = (p: string) => createHash('sha1').update(p).digest('hex').toUpperCase();
const range = (lines: Record<string, number>, seen?: string[]) => (async (url: string | URL | Request) => { const u = String(url); seen?.push(u); const pre = u.split('/range/')[1]; return new Response(Object.entries(lines).filter(([h]) => h.startsWith(pre)).map(([h, c]) => `${h.slice(5)}:${c}`).join('\r\n'), { status: 200 }); }) as typeof fetch;
test('password policy', () => {
  assert.equal(passwordProblem('longenough1'), null); assert.equal(passwordProblem('12345678'), null);
  for (const bad of ['', 'short', '1234567', 'a'.repeat(73), '😀'.repeat(19), 'aaaaaaaa', '        ']) assert.ok(passwordProblem(bad), JSON.stringify(bad));
  assert.equal(passwordProblem('a'.repeat(72)), null); assert.equal(passwordProblem('😀'.repeat(18)), null); // 72 bytes exactly
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
