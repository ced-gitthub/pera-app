// Shared helpers for the production QA suites. These run real Chromium against the deployed app + real Supabase (no mocks).
import { chromium } from 'playwright';
import fs from 'node:fs';
export const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
export const OUT = process.env.OUT_DIR || 'qa-out';
fs.mkdirSync(OUT, { recursive: true });
export const R = []; let group = '';
export const G = g => { group = g; console.log('\n== ' + g); };
const flushNow = () => { try { fs.writeFileSync(`${OUT}/${process.env.SUITE || 'qa'}.partial.md`, R.map(r => `${r.ok ? 'PASS' : 'FAIL'} [${r.group}] ${r.name}${r.ok ? '' : ' — ' + String(typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)).slice(0, 300)}`).join('\n')); } catch {} };
export const T = (name, ok, detail) => { R.push({ group, name, ok: !!ok, detail: ok ? undefined : detail }); flushNow(); console.log(`${ok ? 'PASS' : 'FAIL'} [${group}] ${name}${ok ? '' : ' :: ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400)}`); };
// step: return true to pass; anything else (false/string/object) fails with that as the detail; a throw fails with its message.
let shot = 0;
async function diag() { const pg = globalThis.__page; if (!pg) return ''; try { const url = pg.url().replace(BASE, ''); const f = (await pg.locator('.flash').allInnerTexts().catch(() => [])).join('|'); const t = (await pg.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 160); fs.mkdirSync(OUT + '/fails', { recursive: true }); const n = ++shot; await pg.screenshot({ path: `${OUT}/fails/${String(n).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 40, timeout: 5000 }).catch(() => {}); return ` @${url} #${n} flash="${f}" body="${t}"`; } catch { return ''; } }
export const step = async (name, fn) => { try { const r = await fn(); if (r === true || r === undefined) T(name, true); else T(name, false, (typeof r === 'string' ? r : JSON.stringify(r)) + await diag()); } catch (e) { T(name, false, String(e.message || e).split('\n')[0] + await diag()); } };
// act: click something that triggers a Next server action, then wait for that action's response and the resulting navigation to settle.
export async function act(page, click, { ms = 500 } = {}) { const resp = page.waitForResponse(r => r.request().method() === 'POST' && !!r.request().headers()['next-action'], { timeout: 60000 }); await click(); await resp; await page.waitForLoadState('networkidle'); await page.waitForTimeout(ms); }
export const manila = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() + offsetDays * 864e5));
export const ymd = () => manila();
export const LEAK = /supabase|postgres|pgrst|sql|relation "|violates|stack|at \w+ \(|jwt|42\d\d\d|23\d\d\d|syntax error|undefined|\[object/i;
export async function launch() { return chromium.launch(); }
export async function newCtx(browser, vp = { width: 1280, height: 900 }, extra = {}) { const c = await browser.newContext({ viewport: vp, baseURL: BASE, ...extra }); c.setDefaultTimeout(20000); return c; }
export const flash = async p => { await p.locator('.flash').first().waitFor({ timeout: 7000 }).catch(() => {}); return (await p.locator('.flash').allInnerTexts()).join(' | '); };
export const body = p => p.locator('body').innerText();
export async function signup(page, email, password, name = 'QA Tester') {
  await page.goto('/register'); await page.fill('input[name=name]', name); await page.fill('input[name=email]', email); await page.fill('input[name=password]', password);
  await Promise.all([page.waitForURL(u => new URL(u).pathname !== '/register', { timeout: 30000 }), page.click('button:has-text("Create account")')]);
}
export async function login(page, email, password) {
  await page.goto('/login'); if (new URL(page.url()).pathname !== '/login') { await logout(page); await page.goto('/login'); }
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', password);
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button:has-text("Log in")')]); await page.waitForTimeout(500);
}
export async function logout(page) { await Promise.all([page.waitForURL(/\/login/, { timeout: 20000 }), page.locator('button:has-text("Log out"):visible').first().click()]); }
// Quick Add: reload first so the previous result message is gone, then wait for a definite outcome.
export async function add(page, text, { settle = true } = {}) {
  if (settle) await page.goto(page.url().split('?')[0].replace(/\/$/, '') || '/');
  const i = page.locator('input[aria-label=Transaction]'); await i.fill(text); await i.press('Enter');
  await page.locator('.cheer, p.flash.bad, button:has-text("Spent"), button:has-text("Save"), button:has-text("Retry save"), :text("Nothing to undo"), :text("Deleted"), :text("Restored")').first().waitFor({ timeout: 25000 });
}
export function done(extra = {}) {
  const f = R.filter(r => !r.ok); const out = { base: BASE, at: new Date().toISOString(), pass: R.length - f.length, fail: f.length, ...extra, failed: f, results: R };
  fs.writeFileSync(`${OUT}/${process.env.SUITE || 'qa'}.json`, JSON.stringify(out, null, 1));
  const md = [`# ${process.env.SUITE || 'qa'} — ${out.at}`, `pass ${out.pass} / fail ${out.fail}`, '', ...R.map(r => `- ${r.ok ? 'PASS' : 'FAIL'} [${r.group}] ${r.name}${r.ok ? '' : ' — ' + String(typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)).slice(0, 300)}`)].join('\n');
  fs.writeFileSync(`${OUT}/${process.env.SUITE || 'qa'}.md`, md);
  console.log(`\nRESULT pass ${out.pass} fail ${out.fail}`); return out;
}

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) so the suite can act as a real authenticator app.
import crypto from 'node:crypto';
export function totp(secret, step = 0, now = Date.now()) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', clean = secret.replace(/[\s=]/g, '').toUpperCase(); let bits = ''; for (const ch of clean) bits += A.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) || []).map(b => parseInt(b, 2))); const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(now / 30000) + step));
  const h = crypto.createHmac('sha1', key).update(ctr).digest(), o = h[19] & 15, n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
