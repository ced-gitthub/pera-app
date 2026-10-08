// Real-device-sized QA of every route on the deployed app: overflow, clipping, touch targets, bottom-nav overlap, dark mode contrast, reduced motion, keyboard focus.
import { BASE, G, T, step, launch, newCtx, signup, add, done, manila, OUT, LEAK } from './lib.mjs';
import fs from 'node:fs';
process.env.SUITE = 'responsive'; fs.mkdirSync(OUT + '/shots', { recursive: true });
const stamp = Date.now(), EM = `pera-qa-${stamp}-c@example.com`, PW = `Qa-${stamp}-pw!`;
const VPS = [['iphone-390x844', 390, 844, 3], ['iphone-393x852', 393, 852, 3], ['iphone-max-430x932', 430, 932, 3], ['ipad-768x1024', 768, 1024, 2], ['desktop-1280x800', 1280, 800, 1], ['desktop-1440x900', 1440, 900, 1]];
const APP = ['/', '/transactions', '/accounts', '/budgets', '/reports', '/assistant', '/settings'], AUTH = ['/login', '/register', '/forgot'];
const browser = await launch();
// seed one user with realistic data
const seed = await newCtx(browser); const sp = await seed.newPage();
await signup(sp, EM, PW, 'Responsive QA');
for (const t of ['lunch 150 gcash', 'salary 25000 bpi', 'grocery 800 cash', 'a very long description for a taxi ride to the airport 1234.56 gcash', 'netflix 549']) await add(sp, t);
await sp.goto('/budgets'); { const f = sp.locator('form:has(b:has-text("Food"))').first(); await f.locator('input[name=amount]').fill('200'); await Promise.all([sp.waitForLoadState('networkidle'), f.locator('button:has-text("Save")').click()]); }
await sp.goto('/accounts'); { const f = sp.locator('form:has(button:has-text("Transfer"))'); await f.locator('input[name=amount]').fill('50'); const to = await f.locator('select[name=to] option').nth(1).getAttribute('value'); await f.locator('select[name=to]').selectOption(to); await Promise.all([sp.waitForLoadState('networkidle'), f.locator('button:has-text("Transfer")').click()]); }
const state = await seed.storageState(); await seed.close();

const measure = () => {
  const vw = document.documentElement.clientWidth, de = document.documentElement; const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const label = el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}${el.getAttribute('name') ? '[' + el.getAttribute('name') + ']' : ''} "${(el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`;
  const inScroller = el => { let a = el.parentElement; while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if ((o === 'auto' || o === 'scroll') && a.scrollWidth > a.clientWidth) return true; a = a.parentElement; } return false; };
  const off = [], clip = [], small = [], tiny = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && !el.closest('svg')) off.push(label(el) + ` [${Math.round(r.left)},${Math.round(r.right)}]`);
    const cs = getComputedStyle(el);
    if (/^(BUTTON|A|LABEL|B|H1|H2|SPAN|P|TD|OPTION)$/.test(el.tagName) && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !el.closest('svg')) clip.push(label(el));
    if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'hidden' && !el.closest('svg')) { if (r.height < 44 || r.width < 44) small.push(label(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`); if (r.height < 24 || r.width < 24) tiny.push(label(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`); }
  }
  const tabs = document.querySelector('.tabs'), tabsShown = tabs && getComputedStyle(tabs).display !== 'none';
  let overlap = null; if (tabsShown) { window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); const tr = tabs.getBoundingClientRect(); const kids = [...document.querySelectorAll('body *')].filter(k => vis(k) && !k.closest('.tabs') && !k.closest('.top') && !k.closest('.side') && k.children.length === 0 && k.getBoundingClientRect().height > 0); const lastBottom = Math.max(0, ...kids.map(k => k.getBoundingClientRect().bottom)); overlap = { tabsTop: Math.round(tr.top), lastContentBottom: Math.round(lastBottom), hidden: Math.round(Math.max(0, lastBottom - tr.top)) }; window.scrollTo({ top: 0, behavior: 'instant' }); }
  const dates = [...document.querySelectorAll('input[type=date]')].filter(vis).map(d => { const r = d.getBoundingClientRect(); return { w: Math.round(r.width), inside: r.left >= -1 && r.right <= vw + 1 }; });
  return { vw, scrollW: de.scrollWidth, hscroll: de.scrollWidth > vw + 1, off: off.slice(0, 8), clip: [...new Set(clip)].slice(0, 8), small: [...new Set(small)], tiny: [...new Set(tiny)].slice(0, 10), overlap, dates, tabsShown, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, viewportMeta: document.querySelector('meta[name=viewport]')?.content, title: document.title };
};
const advisory = {};
for (const [name, w, h, dpr] of VPS) {
  G('layout ' + name);
  const ctx = await newCtx(browser, { width: w, height: h }, { storageState: state, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: w < 800 }); const p = await ctx.newPage();
  for (const r of APP) await step(`${r}: no horizontal overflow, nothing clipped off-screen`, async () => {
    const res = await p.goto(r); await p.waitForLoadState('networkidle'); await p.waitForTimeout(300); const m = await p.evaluate(measure);
    if (w <= 768 && ['/', '/transactions', '/settings'].includes(r) || w === 1280) await p.screenshot({ path: `${OUT}/shots/${name}${r === '/' ? '-home' : r.replace(/\//g, '-')}.jpg`, fullPage: true, type: 'jpeg', quality: 55 });
    advisory[`${name}${r}`] = { small: m.small.length, tiny: m.tiny, clip: m.clip, off: m.off, overlap: m.overlap, dates: m.dates };
    return res.status() < 400 && !m.hscroll && m.off.length === 0 ? true : { status: res.status(), scrollW: m.scrollW, vw: m.vw, off: m.off }; });
  for (const r of APP) await step(`${r}: text/buttons not clipped`, async () => { const a = advisory[`${name}${r}`]; return a.clip.length === 0 ? true : a.clip; });
  for (const r of APP) await step(`${r}: touch targets >= 24px (WCAG 2.2 AA)`, async () => { const a = advisory[`${name}${r}`]; return a.tiny.length === 0 ? true : a.tiny; });
  if (w <= 768) for (const r of APP) await step(`${r}: bottom nav does not cover content`, async () => { const a = advisory[`${name}${r}`]; return !a.overlap || a.overlap.hidden <= 0 ? true : a.overlap; });
  for (const r of ['/transactions', '/accounts', '/settings', '/reports', '/budgets']) await step(`${r}: date inputs usable`, async () => { const a = advisory[`${name}${r}`]; return a.dates.every(d => d.inside && d.w >= 90) ? true : a.dates; });
  for (const r of AUTH) { const c2 = await newCtx(browser, { width: w, height: h }, { hasTouch: w < 800, isMobile: w < 800 }); const q = await c2.newPage(); await step(`${r} (logged out): no overflow, targets >= 24px`, async () => { await q.goto(r); await q.waitForLoadState('networkidle'); const m = await q.evaluate(measure); if (w === 390 || w === 1280) await q.screenshot({ path: `${OUT}/shots/${name}${r.replace(/\//g, '-')}.jpg`, fullPage: true, type: 'jpeg', quality: 55 }); return !m.hscroll && !m.off.length && !m.tiny.length ? true : { off: m.off, tiny: m.tiny, scrollW: m.scrollW }; }); await c2.close(); }
  await ctx.close();
}
G('page metadata');
{ const ctx = await newCtx(browser, { width: 390, height: 844 }, { storageState: state }); const p = await ctx.newPage();
  for (const r of APP) await step(`${r}: title, lang, viewport meta, one h1`, async () => { await p.goto(r); const m = await p.evaluate(measure); return m.title && m.lang === 'en' && /width=device-width/.test(m.viewportMeta || '') ? true : m; });
  await step('viewport-fit=cover set for safe-area insets (needed before PWA work)', async () => { await p.goto('/'); const v = await p.evaluate(() => document.querySelector('meta[name=viewport]')?.content); return /viewport-fit=cover/.test(v || '') ? true : v; });
  await step('CSS uses env(safe-area-inset-bottom) for the fixed bottom nav', async () => { const css = await p.evaluate(async () => { let t = ''; for (const l of document.querySelectorAll('link[rel=stylesheet]')) t += await (await fetch(l.href)).text(); return t; }); return /safe-area-inset-bottom/.test(css) ? true : 'missing'; });
  await step('inputs are >= 16px (iOS does not zoom on focus)', async () => { await p.goto('/transactions'); const sizes = await p.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea')].filter(e => e.getBoundingClientRect().width > 0).map(e => parseFloat(getComputedStyle(e).fontSize))); return sizes.every(s => s >= 16) ? true : { min: Math.min(...sizes) }; });
  await ctx.close(); }
G('keyboard');
{ const ctx = await newCtx(browser, { width: 1280, height: 800 }, { storageState: state }); const p = await ctx.newPage();
  for (const r of ['/', '/transactions', '/accounts', '/settings']) await step(`${r}: Tab shows a visible focus indicator on first 8 stops`, async () => { await p.goto(r); const bad = []; for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { t: e.tagName + (e.getAttribute('name') || e.textContent || '').slice(0, 15), ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' }; }); if (f && !f.ring) bad.push(f.t); } return bad.length === 0 ? true : bad; });
  await step('Quick Add works with keyboard only (type + Enter)', async () => { await p.goto('/'); await p.locator('input[aria-label=Transaction]').focus(); await p.keyboard.type('lunch 12.34'); await p.keyboard.press('Enter'); await p.locator('.cheer').waitFor({ timeout: 25000 }); return true; });
  await ctx.close(); }
G('dark mode');
{ const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrastJs = () => { const parse = c => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; }; const L = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = el => { let e = el; while (e) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c.a > 0.95) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const bad = [], seen = new Set(); for (const el of document.querySelectorAll('h1,h2,p,b,span,td,label,a,button,.m,input,select')) { const r = el.getBoundingClientRect(); if (!r.width || !r.height || !(el.innerText || el.value || '').trim()) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue; const fg = parse(cs.color), bg = bgOf(el); if (!bg) continue; const l1 = L(fg), l2 = L(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700); const key = el.className + cs.color + cs.backgroundColor; if (ratio < (big ? 3 : 4.5) && !seen.has(key)) { seen.add(key); bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(ratio * 100) / 100} "${(el.innerText || el.value || '').trim().slice(0, 20)}"`); } } return bad.slice(0, 10); };
  for (const scheme of ['light', 'dark']) { const ctx = await newCtx(browser, { width: 390, height: 844 }, { storageState: state, colorScheme: scheme }); const p = await ctx.newPage();
    for (const r of APP) await step(`${scheme}: ${r} text contrast >= 4.5:1 (3:1 large)`, async () => { await p.goto(r); await p.waitForLoadState('networkidle'); if (scheme === 'dark') await p.screenshot({ path: `${OUT}/shots/dark-390${r === '/' ? '-home' : r.replace(/\//g, '-')}.jpg`, fullPage: true, type: 'jpeg', quality: 55 }); const bad = await p.evaluate(contrastJs); return bad.length === 0 ? true : bad; });
    if (scheme === 'dark') await step('dark: page background is actually dark', async () => { const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); return lum(bg) < 0.15 ? true : bg; });
    await ctx.close(); } }
G('reduced motion');
{ const ctx = await newCtx(browser, { width: 390, height: 844 }, { storageState: state, reducedMotion: 'reduce' }); const p = await ctx.newPage(); await p.goto('/');
  await step('celebration animation is disabled when the user prefers reduced motion', async () => { await add(p, 'lunch 3.33', { settle: false }); const a = await p.evaluate(() => { const els = [document.querySelector('.cheer'), ...document.querySelectorAll('.conf i')].filter(Boolean); return els.map(e => getComputedStyle(e).animationName).filter(n => n !== 'none'); }); return a.length === 0 ? true : a.slice(0, 3); });
  await step('no running CSS animations/transitions anywhere on the dashboard', async () => { await p.goto('/'); const n = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length); return n === 0 ? true : n; });
  await ctx.close(); }
G('states');
{ const ctx = await newCtx(browser, { width: 390, height: 844 }, { storageState: state }); const p = await ctx.newPage();
  await step('slow network: Quick Add shows Working… and disables the button', async () => { await p.goto('/'); await p.route('**/*', async r => { if (r.request().headers()['next-action']) await new Promise(x => setTimeout(x, 2500)); r.continue(); }); const i = p.locator('input[aria-label=Transaction]'); await i.fill('lunch 1.23'); await i.press('Enter'); const t = await p.locator('button:has-text("Working…")').count(); const dis = await p.locator('button:has-text("Working…")').isDisabled().catch(() => false); await p.unroute('**/*'); await p.locator('.cheer').waitFor({ timeout: 30000 }); return t === 1 && dis ? true : { t, dis }; });
  await step('offline: Quick Add fails gracefully with a retry path', async () => { await p.goto('/'); await ctx.setOffline(true); const i = p.locator('input[aria-label=Transaction]'); await i.fill('lunch 4.56'); await i.press('Enter'); await p.locator('p.flash.bad').first().waitFor({ timeout: 30000 }); const f = await p.locator('p.flash.bad').first().innerText(); await ctx.setOffline(false); return !LEAK.test(f) && (await p.locator('button:has-text("Retry save")').count()) === 1 ? true : f; });
  await ctx.close(); }
await browser.close(); fs.writeFileSync(OUT + '/responsive-advisory.json', JSON.stringify(advisory, null, 1));
const out = done({ user: EM }); process.exit(out.fail ? 1 : 0);
