// Temporary diagnostic: repeat the "change password" success path to measure how often the content area comes back blank.
import { G, T, step, act, launch, newCtx, flash, body, signup, done } from './lib.mjs';
process.env.SUITE = 'repro';
const stamp = Date.now(), em = `pera-qa-${stamp}-r@example.com`; let pw = `Qa-${stamp}-pw!`;
const browser = await launch(), ctx = await newCtx(browser), p = await ctx.newPage(); globalThis.__page = p;
const log = []; p.on('console', m => { if (/error|warn/.test(m.type())) log.push(m.type() + ': ' + m.text().slice(0, 160)); }); p.on('pageerror', e => log.push('pageerror: ' + e.message.slice(0, 160))); p.on('requestfailed', r => log.push('requestfailed: ' + r.url().replace(process.env.BASE_URL, '') + ' ' + (r.failure()?.errorText ?? '')));
G('repeat change-password success path');
await signup(p, em, pw);
const stats = [];
for (let i = 1; i <= 14; i++) {
  await step(`change password #${i}: page content is present after the redirect`, async () => {
    const next = `Qa-${stamp}-pw${i}!`; await p.goto('/security'); const f = p.locator('form:has(input[name=current])'); await f.locator('input[name=current]').fill(pw); await f.locator('input[name=password]').fill(next); await f.locator('input[name=confirm]').fill(next);
    log.length = 0; await act(p, () => f.locator('button:has-text("Change password")').click()); const fl = await flash(p); const mainLen = await p.evaluate(() => document.querySelector('main')?.innerHTML.length ?? -1);
    stats.push({ i, flash: /Password changed/.test(fl), mainLen }); if (/Password changed/.test(fl)) { pw = next; return true; }
    const url = p.url().replace(process.env.BASE_URL, ''); await p.reload(); const after = await flash(p).catch(() => ''); pw = next; // the change itself went through; see whether a reload shows the page
    return { url, mainLen, afterReload: after.slice(0, 80), log: log.slice(-6) };
  });
}
const out = done({ stats }); await browser.close(); process.exit(out.fail ? 1 : 0);
