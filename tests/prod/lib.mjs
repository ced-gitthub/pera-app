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
export const step = async (name, fn) => { try { const r = await fn(); T(name, r === true || r === undefined, r); } catch (e) { T(name, false, String(e.message || e).split('\n')[0]); } };
export const manila = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() + offsetDays * 864e5));
export const ymd = () => manila();
export const LEAK = /supabase|postgres|pgrst|sql|relation "|violates|stack|at \w+ \(|jwt|42\d\d\d|23\d\d\d|syntax error|undefined|\[object/i;
export async function launch() { return chromium.launch(); }
export async function newCtx(browser, vp = { width: 1280, height: 900 }, extra = {}) { const c = await browser.newContext({ viewport: vp, baseURL: BASE, ...extra }); c.setDefaultTimeout(20000); return c; }
export const flash = async p => (await p.locator('.flash').allInnerTexts()).join(' | ');
export const body = p => p.locator('body').innerText();
export async function signup(page, email, password, name = 'QA Tester') {
  await page.goto('/register'); await page.fill('input[name=name]', name); await page.fill('input[name=email]', email); await page.fill('input[name=password]', password);
  await Promise.all([page.waitForURL(u => new URL(u).pathname !== '/register', { timeout: 30000 }), page.click('button:has-text("Create account")')]);
}
export async function login(page, email, password) {
  await page.goto('/login'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', password);
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
