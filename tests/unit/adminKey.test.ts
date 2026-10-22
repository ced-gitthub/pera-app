import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeServerKey } from '../../src/lib/admin/adminKey.ts';

test('server key check: a publishable key or an empty value is never accepted as the secret key', () => {
  assert.equal(looksLikeServerKey(undefined), false);
  assert.equal(looksLikeServerKey(''), false);
  assert.equal(looksLikeServerKey('  '), false);
  assert.equal(looksLikeServerKey('sb_publishable_abc123'), false);
  assert.equal(looksLikeServerKey('sb_secret_abc123'), true);
  assert.equal(looksLikeServerKey('a.b.c'), true); // legacy JWT-style key
});
