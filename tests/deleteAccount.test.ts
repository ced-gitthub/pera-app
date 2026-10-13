import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDeleteRequest, tokenAal, bearerToken } from '../src/lib/deleteAccount.ts';

const NOW = Date.parse('2026-10-14T10:00:00Z');
const base = {
  confirm: 'DELETE',
  adminReady: true,
  hasVerifiedFactor: false,
  aal: 'aal1' as string | undefined,
  signedInAt: new Date(NOW - 2 * 60_000).toISOString() as string | undefined,
  now: NOW,
};

test('delete account: allowed only with the typed word, a configured server and a recent sign-in', () => {
  assert.deepEqual(checkDeleteRequest(base), { ok: true });
});

test('delete account: the word must be exactly DELETE', () => {
  for (const confirm of ['', 'delete', 'Delete', 'DELETE ME', ' ']) {
    const r = checkDeleteRequest({ ...base, confirm });
    assert.ok(!r.ok && r.status === 400 && /DELETE/.test(r.error), JSON.stringify(confirm));
  }
  assert.deepEqual(checkDeleteRequest({ ...base, confirm: ' DELETE ' }), { ok: true }); // surrounding spaces are harmless
});

test('delete account: refuses when the server cannot do it, without pretending', () => {
  const r = checkDeleteRequest({ ...base, adminReady: false });
  assert.ok(!r.ok && r.status === 503 && /not available/i.test(r.error));
});

test('delete account: a two-step account needs a two-step (aal2) session', () => {
  const blocked = checkDeleteRequest({ ...base, hasVerifiedFactor: true, aal: 'aal1' });
  assert.ok(!blocked.ok && blocked.status === 403 && /two-step/i.test(blocked.error));
  assert.deepEqual(checkDeleteRequest({ ...base, hasVerifiedFactor: true, aal: 'aal2' }), { ok: true });
  const noAal = checkDeleteRequest({ ...base, hasVerifiedFactor: true, aal: undefined });
  assert.ok(!noAal.ok);
});

test('delete account: the session must have signed in within the last 10 minutes', () => {
  const old = checkDeleteRequest({ ...base, signedInAt: new Date(NOW - 11 * 60_000).toISOString() });
  assert.ok(!old.ok && old.status === 403 && /sign in again/i.test(old.error));
  assert.equal(checkDeleteRequest({ ...base, signedInAt: new Date(NOW - 9 * 60_000).toISOString() }).ok, true);
  assert.equal(checkDeleteRequest({ ...base, signedInAt: undefined }).ok, false);
  assert.equal(checkDeleteRequest({ ...base, signedInAt: 'garbage' }).ok, false);
  assert.equal(checkDeleteRequest({ ...base, signedInAt: new Date(NOW + 60 * 60_000).toISOString() }).ok, false); // a time in the future is not "recent"
});

test('delete account: reads the aal claim and the bearer token safely', () => {
  const jwt = (p: object) => 'x.' + Buffer.from(JSON.stringify(p)).toString('base64url') + '.y';
  assert.equal(tokenAal(jwt({ aal: 'aal2' })), 'aal2');
  assert.equal(tokenAal(jwt({})), undefined);
  assert.equal(tokenAal('nonsense'), undefined);
  assert.equal(bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(bearerToken('bearer abc'), 'abc');
  assert.equal(bearerToken('Basic abc'), null);
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken('Bearer '), null);
});

import { hasVerifiedFactor } from '../src/lib/deleteAccount.ts';
test('delete account: ANY verified factor (totp, phone, webauthn) counts as two-step', () => {
  assert.equal(hasVerifiedFactor(undefined), false);
  assert.equal(hasVerifiedFactor([]), false);
  assert.equal(hasVerifiedFactor([{ factor_type: 'totp', status: 'unverified' }]), false);
  for (const factor_type of ['totp', 'phone', 'webauthn', 'something-new'])
    assert.equal(hasVerifiedFactor([{ factor_type, status: 'verified' }]), true, factor_type);
});
