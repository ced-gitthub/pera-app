import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_DELETES, RECORDS_DELETE, canDeleteAccount, interpretDeleteResponse } from '../native/src/deleteAccountLogic.ts';
import { requestAccountDeletion } from '../native/src/deleteAccountCore.ts';

test('the two delete choices say specifically what they remove and what they keep', () => {
  const records = RECORDS_DELETE.join(' ').toLowerCase();
  for (const w of ['entries', 'budgets', 'goals']) assert.match(records, new RegExp(w));
  assert.match(RECORDS_DELETE.join(' '), /stay|kept|keep/i); // says what is NOT deleted (the login, accounts, categories)
  const account = ACCOUNT_DELETES.join(' ').toLowerCase();
  for (const w of ['login', 'accounts', 'categories', 'entries', 'budgets', 'goals', 'recurring', 'permanent'])
    assert.match(account, new RegExp(w));
  assert.match(account, /cannot be undone|can't be undone|no way to undo/);
});

test('account deletion needs the exact word', () => {
  assert.equal(canDeleteAccount('DELETE'), true);
  assert.equal(canDeleteAccount(' delete '), true); // same lenient rule as the data reset: case and spaces do not matter
  for (const bad of ['', 'DELET', 'DELETE MY ACCOUNT', 'yes']) assert.equal(canDeleteAccount(bad), false, bad);
});

test('server answers become plain messages; raw text never shows', () => {
  assert.deepEqual(interpretDeleteResponse(200, { ok: true }), { kind: 'deleted' });
  const old = interpretDeleteResponse(403, {
    error: 'For your safety, log out, sign in again, then delete your account within 10 minutes.',
  });
  assert.deepEqual(old, { kind: 'error', message: 'For your safety, log out, sign in again, then delete your account within 10 minutes.' });
  const missing = interpretDeleteResponse(404, '<html>raw</html>');
  assert.equal(missing.kind, 'unavailable');
  const boom = interpretDeleteResponse(500, { error: 'duplicate key value violates something (raw)' });
  assert.equal(boom.kind, 'error');
  assert.ok(boom.kind === 'error' && !/duplicate key|raw/.test(boom.message));
  const weird = interpretDeleteResponse(502, null);
  assert.ok(weird.kind === 'error' && /try again/i.test(weird.message));
});

test('the request sends the bearer token and the typed word to the server only, to the right address', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await requestAccountDeletion(fakeFetch, 'https://example.test/', 'tok123', 'DELETE');
  assert.deepEqual(r, { kind: 'deleted' });
  assert.equal(seen[0].url, 'https://example.test/api/native/delete-account'); // no double slash
  assert.equal(seen[0].init.method, 'POST');
  assert.equal((seen[0].init.headers as Record<string, string>).Authorization, 'Bearer tok123');
  assert.deepEqual(JSON.parse(String(seen[0].init.body)), { confirm: 'DELETE' });
});

test('a network failure is reported as not confirmed, never as deleted', async () => {
  const down = (async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  const r = await requestAccountDeletion(down, 'https://example.test', 't', 'DELETE');
  assert.ok(r.kind === 'unconfirmed' && /could not confirm|check your connection/i.test(r.message));
  assert.ok(r.kind === 'unconfirmed' && !/Network request failed/.test(r.message));
});

test('the delete is never retried by the client, and an empty token is refused before any request', async () => {
  let calls = 0;
  const f = (async () => {
    calls++;
    return new Response('{}', { status: 500 });
  }) as unknown as typeof fetch;
  await requestAccountDeletion(f, 'https://example.test', 't', 'DELETE');
  assert.equal(calls, 1);
  const none = await requestAccountDeletion(f, 'https://example.test', '', 'DELETE');
  assert.equal(none.kind, 'error');
  assert.equal(calls, 1);
});

test('a lost answer is "unconfirmed" (the account may already be gone), and a gone account is recognised on retry', async () => {
  const down = (async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  const r = await requestAccountDeletion(down, 'https://example.test', 't', 'DELETE');
  assert.equal(r.kind, 'unconfirmed');
  const { sessionGone } = await import('../native/src/deleteAccountLogic.ts');
  assert.equal(sessionGone({ status: 401 }), true);
  assert.equal(sessionGone({ status: 403 }), true);
  assert.equal(sessionGone({ status: 404 }), true);
  assert.equal(sessionGone({ status: 500 }), false);
  assert.equal(sessionGone({}), false); // a plain network error says nothing
  assert.equal(sessionGone(null), false);
});
