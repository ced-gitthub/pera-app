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
test('free-plan usage: production deploys skip commits that change nothing deployable, and previews are not built', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(
    v.ignoreCommand.length <= 256,
    'Vercel rejects an ignoreCommand longer than 256 characters (a rejected vercel.json breaks every deploy)',
  );
  assert.equal(v.ignoreCommand, 'sh scripts/vercel-ignore.sh');
  const sh = readFileSync('scripts/vercel-ignore.sh', 'utf8');
  assert.ok(sh.includes('[ "$VERCEL_ENV" = "production" ] || exit 0'), 'previews are not built');
  assert.ok(
    sh.includes('VERCEL_GIT_PREVIOUS_SHA'),
    'compare with the last deployed commit, so a docs-only newest commit cannot hide an earlier src change',
  );
  assert.ok(!sh.includes('HEAD^ '), 'never compare with the parent commit only');
  assert.equal(sh.split('|| exit 1').length - 1, 2, 'build whenever the previous commit is unknown or missing');
  assert.ok(sh.includes('git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- $(cat scripts/deployable-paths)'));
  const paths = readFileSync('scripts/deployable-paths', 'utf8').trim().split('\n');
  for (const must of [
    'src',
    'public',
    'next.config.mjs',
    'package.json',
    'package-lock.json',
    'vercel.json',
    'scripts/vercel-ignore.sh',
    'scripts/deployable-paths',
  ])
    assert.ok(paths.includes(must), must + ' must trigger a deploy');
  for (const p of paths) assert.ok(!/^(tests|docs|native|\.github|supabase)/.test(p), p + ' must not trigger a deploy');
  const w = readFileSync('.github/workflows/prod-qa.yml', 'utf8');
  assert.equal(
    w.split('cat scripts/deployable-paths').length - 1,
    2,
    'both wait steps wait for the newest DEPLOYABLE commit, not the newest commit',
  );
  assert.equal(w.split('git fetch --unshallow').length - 1, 2);
});
test('free-plan usage: the live suites run one at a time and not for test-only or native-only commits', () => {
  const w = readFileSync('.github/workflows/prod-qa.yml', 'utf8');
  assert.match(w, /concurrency:\s+group: prod-qa/);
  const paths = w.match(/paths: \[(.*)\]/)![1];
  assert.doesNotMatch(paths, /tests\/prod|native|docs|supabase/, 'only commits that Vercel will actually deploy');
  assert.match(paths, /src\/\*\*/);
  assert.doesNotMatch(w, /testing whatever is live/, 'never test stale code: fail when production does not serve the commit');
});
test('the email-confirmed banner shows only for the exact fixed message', async () => {
  const { isConfirmed, CONFIRMED } = await import('../src/lib/okMessage.ts');
  assert.equal(isConfirmed('?ok=' + encodeURIComponent(CONFIRMED)), true);
  assert.equal(isConfirmed('?ok=' + encodeURIComponent('Your bank is closed. Call 0917...')), false);
  assert.equal(isConfirmed('?ok='), false);
  assert.equal(isConfirmed(''), false);
});
test('free-plan usage: the landing page is static (no searchParams or cookies) and CDN-cacheable', () => {
  const page = readFileSync('src/app/welcome/page.tsx', 'utf8');
  assert.doesNotMatch(page, /searchParams|cookies\(|headers\(/);
  const cfg = readFileSync('next.config.mjs', 'utf8');
  assert.match(cfg, /source: '\/welcome'[^}]*s-maxage=3600/);
  assert.ok(
    cfg.indexOf("source: '/welcome'") > cfg.indexOf('private, no-store'),
    'the /welcome rule must come after the no-store rule so it wins',
  );
});
