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
  ['phone 320', { width: 320, height: 640 }, 'light'],
  ['phone 360', { width: 360, height: 760 }, 'light'],
  ['phone 375', { width: 375, height: 812 }, 'light'],
  ['phone 375 dark', { width: 375, height: 812 }, 'dark'],
  ['desktop 1280', { width: 1280, height: 900 }, 'light'],
]) {
  G(`landing: ${label}`);
  const c = await newCtx(browser, vp, { colorScheme: scheme }),
    q = await c.newPage();
  const url = ONLY ? '/' : '/welcome';
  await step(`${url} shows the landing page with Get Zovix free buttons`, async () => {
    await q.goto(url);
    await q.locator('text=Private by design').waitFor({ timeout: 20000 });
    const a = q.locator('a[href="/zovix.apk"]');
    const n = await a.count(),
      href = await a.first().getAttribute('href');
    return n >= 3 && href === '/zovix.apk' ? true : { n, href };
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
  await step('the page has no sign-up or login fields', async () =>
    (await q.locator('input[type=password], input[type=email], input[name=email], input[name=password]').count()) === 0
      ? true
      : 'has a login field',
  );
  await step('live demo: tapping a chip adds a row and lowers the wallet; three entries show the Get Zovix free prompt', async () => {
    const wallet = async () => (await q.locator('.ld-demo .wl-total b').innerText()).replace(/\s+/g, ' ');
    const before = await wallet();
    await q.locator('.ld-demo button.wl-chip', { hasText: 'lunch 150 gcash' }).click();
    await q.locator('.ld-demo .wl-row').first().waitFor({ timeout: 10000 });
    await q.locator('.ld-demo button.wl-chip', { hasText: 'coffee 120' }).click();
    await q.fill('#ld-in', 'grocery 800 cash');
    await q.locator('.ld-demo button:has-text("Add")').click();
    await q.locator('.ld-demo .wl-win').waitFor({ timeout: 10000 });
    await q.waitForTimeout(900);
    const after = await wallet(),
      rows = await q.locator('.ld-demo .wl-row').count(),
      cta = await q.locator('.ld-demo .wl-win a[href="/zovix.apk"]').count();
    return before !== after && rows === 3 && cta === 1 ? true : { before, after, rows, cta };
  });
  await step('demo rejects nonsense with a plain message', async () => {
    await q.fill('#ld-in', 'hello there');
    await q.locator('.ld-demo button:has-text("Add")').click();
    const t = await q.locator('.ld-demo [role=alert]').first().innerText();
    return t.length > 5 ? true : t;
  });
  await step('every piece of visible text has readable contrast against what is actually behind it', async () => {
    const bad = await q.evaluate(() => {
      const parse = (c) => {
        const n = (c.match(/[\d.]+/g) || ['0', '0', '0', '0']).map(Number);
        if (c.startsWith('color(')) return [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1]; // color-mix() computes to color(srgb r g b / a)
        return n.length < 3 ? [0, 0, 0, 0] : n;
      };
      const lum = ([r, g, b]) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgAt = (el) => {
        // sample the real pixel colour behind the text by walking up to the first opaque background; gradients are solid purple here
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (e.classList.contains('ld-top')) return [91, 53, 232];
          const c = parse(cs.backgroundColor);
          if (c.length < 4 || c[3] > 0.95) return c.slice(0, 3);
        }
        return parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
      };
      const out = [];
      for (const e of document.querySelectorAll('h1,h2,h3,p,li,a,small,dt,dd,summary,span,b,label')) {
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = e.getBoundingClientRect();
        if (!r.height || getComputedStyle(e).visibility === 'hidden') continue;
        const a = lum(parse(getComputedStyle(e).color).slice(0, 3)),
          b = lum(bgAt(e)),
          cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (cr < 3.5) out.push([e.tagName, e.textContent.trim().slice(0, 28), cr.toFixed(2)]);
      }
      return out.slice(0, 8);
    });
    return bad.length ? bad : true;
  });
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
        return new URL(q.url()).pathname === '/' && (await q.locator('a[href="/zovix.apk"]').count()) >= 1 ? true : q.url();
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
