// Live check of the landing page (needs no account, so it also runs while Supabase Confirm email is ON).
// Always runs the landing checks on /welcome. With LANDING_ONLY=1 (after WEB_APP_ENABLED is switched off) it also proves "/" is the
// landing page for everyone and every tracker route is retired.
import { BASE, G, step, launch, newCtx, done } from './lib.mjs';
process.env.SUITE = 'landing';
const ONLY = process.env.LANDING_ONLY === '1';
const TRACKER = [
  '/login',
  '/register',
  '/code',
  '/transactions',
  '/accounts',
  '/budgets',
  '/reports',
  '/assistant',
  '/settings',
  '/security',
];
const browser = await launch();
for (const [label, vp, scheme] of [
  ['phone 375', { width: 375, height: 812 }, 'light'],
  ['phone 375 dark', { width: 375, height: 812 }, 'dark'],
  ['desktop 1280', { width: 1280, height: 900 }, 'light'],
]) {
  G(`landing: ${label}`);
  const c = await newCtx(browser, vp, { colorScheme: scheme }),
    q = await c.newPage();
  const url = ONLY ? '/' : '/welcome';
  await step(`${url} shows the landing page with a Download for Android button`, async () => {
    await q.goto(url);
    await q.locator('text=Private by design').waitFor({ timeout: 20000 });
    const a = q.locator('a:has-text("Download for Android")');
    const n = await a.count(),
      href = await a.first().getAttribute('href');
    return n >= 2 && href === '/zovix.apk' ? true : { n, href };
  });
  await step('no sideways scroll and nothing wider than the screen', async () => {
    const o = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    return o.sw <= o.cw + 1 ? true : o;
  });
  await step('has the introduction, how it works, worked samples, benefits, levels, privacy and FAQ', async () => {
    const t = (await q.locator('body').innerText()).replace(/\s+/g, ' ').toLowerCase();
    const need = [
      'What it is',
      'How it works',
      'lunch 150 gcash',
      'What Zovix does',
      'What you get',
      'Broke Rookie',
      'Private by design',
      'Is Zovix really free?',
      'iPhone',
    ];
    const miss = need.filter((x) => !t.includes(x.toLowerCase()));
    return miss.length ? miss : true;
  });
  await step('a FAQ answer opens when tapped', async () => {
    const d = q.locator('details.ld-faq').first();
    await d.locator('summary').click();
    return (await d.evaluate((e) => e.open)) ? true : 'did not open';
  });
  await step('the page makes no sign-up or login fields', async () =>
    (await q.locator('input, form').count()) === 0 ? true : 'has a form',
  );
  if (ONLY)
    await step('no link to the web tracker', async () => {
      const hrefs = await q.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      const bad = hrefs.filter((h) => TRACKER.some((p) => h === p || h.startsWith(p + '/')));
      return bad.length ? bad : true;
    });
  await c.close();
}
G('landing: files and redirects');
{
  const c = await newCtx(browser),
    r = c.request;
  await step('the APK download is served', async () => {
    const x = await r.head(BASE + '/zovix.apk');
    return x.ok() ? true : x.status();
  });
  for (const p of ['/privacy', '/api/health', '/.well-known/assetlinks.json'])
    await step(`${p} still works`, async () => {
      const x = await r.get(BASE + p);
      return x.ok() ? true : x.status();
    });
  if (ONLY) {
    const q = await c.newPage();
    for (const p of [...TRACKER, '/welcome', '/transactions/abc', '/nope'])
      await step(`${p} redirects to the landing page`, async () => {
        await q.goto(p);
        return new URL(q.url()).pathname === '/' && (await q.locator('a:has-text("Download for Android")').count()) >= 1 ? true : q.url();
      });
    for (const p of ['/forgot', '/verify'])
      await step(`${p} (recovery) still opens`, async () => {
        await q.goto(p);
        return new URL(q.url()).pathname === p ? true : q.url();
      });
  } else
    await step('web app on: / for a logged-out visitor goes to the landing page', async () => {
      const q = await c.newPage();
      await q.goto('/');
      return new URL(q.url()).pathname === '/welcome' ? true : q.url();
    });
  await c.close();
}
await browser.close();
const out = done({ landingOnly: ONLY });
process.exit(out.fail ? 1 : 0);
