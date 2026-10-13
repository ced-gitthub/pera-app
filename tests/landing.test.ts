import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landingOnlyRoute } from '../src/lib/webRoutes.ts';
import { WEB_APP_ENABLED, webAppEnabled, APK_URL } from '../src/lib/site.ts';
const kind = (p: string) => landingOnlyRoute(p).kind;
test('the web app stays switched on by default; the env var can switch it off for testing', () => {
  assert.equal(WEB_APP_ENABLED, true);
  assert.equal(webAppEnabled({}), true);
  assert.equal(webAppEnabled({ WEB_APP_ENABLED: 'false' }), false);
  assert.equal(webAppEnabled({ WEB_APP_ENABLED: 'true' }), true);
});
test('landing-only: "/" is the landing page; privacy and health are public', () => {
  assert.equal(kind('/'), 'landing');
  for (const p of ['/privacy', '/api/health', '/offline.html']) assert.equal(kind(p), 'public', p);
});
test('landing-only: recovery pages, email callback and export keep working', () => {
  for (const p of ['/auth/callback', '/forgot', '/verify', '/reset', '/export', '/2fa']) assert.equal(kind(p), 'session', p);
});
test('landing-only: every tracker route (and anything unknown) redirects to "/"', () => {
  for (const p of [
    '/login',
    '/register',
    '/code',
    '/welcome',
    '/transactions',
    '/transactions/abc',
    '/accounts',
    '/budgets',
    '/reports',
    '/assistant',
    '/settings',
    '/security',
    '/nope',
    '/exportx',
    '/privacyx',
  ])
    assert.deepEqual(landingOnlyRoute(p), { kind: 'redirect', to: '/' }, p);
});
test('the APK is served from this site and the landing page links to it', () => {
  assert.equal(APK_URL, '/zovix.apk');
  assert.match(readFileSync('src/components/Landing.tsx', 'utf8'), /APK_URL/);
});

test("landing-only: the native app's own routes stay reachable (account deletion), a look-alike path does not", () => {
  assert.equal(kind('/api/native/delete-account'), 'public');
  assert.equal(kind('/api/nativeish'), 'redirect');
  assert.equal(kind('/api'), 'redirect');
});
