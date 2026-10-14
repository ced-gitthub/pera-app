// Production QA for email confirmation handling, password rules, the security page, two-step verification (real authenticator codes), DB-level enforcement and loading skeletons.
// Real Chromium -> deployed Vercel app -> real Supabase. Creates throwaway users pera-qa-*@example.com. Note: Supabase "Confirm email" is OFF while these run, so the unconfirmed-login branch cannot be exercised live (it is covered by the app tests).
import { createClient } from '@supabase/supabase-js';
import { BASE, G, T, step, act, launch, newCtx, flash, body, signup, login, logout, done, totp, LEAK } from './lib.mjs';
process.env.SUITE = 'security';
const stamp = Date.now(),
  PW = `Qa-${stamp}-pw!`,
  PW2 = PW + 'x',
  em = (t) => `pera-qa-${stamp}-${t}@example.com`;
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_PUBLISHABLE_KEY,
  mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const browser = await launch();
const dialogs = [];
const ctx = await newCtx(browser),
  p = await ctx.newPage();
p.on('dialog', (d) => {
  dialogs.push(d.message());
  d.dismiss();
});
globalThis.__page = p;
const path = (pg) => new URL(pg.url()).pathname;
const overflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// Type a code the way a person would and see whether the app accepts it; tries this 30 s window, then the next, then the previous one.
async function enter(pg, sel, secret, ok, { click } = {}) {
  for (const s of [0, 1, -1]) {
    await pg.locator(sel).fill(totp(secret, s));
    if (click) await pg.click(click);
    const t = Date.now();
    while (Date.now() - t < 7000) {
      if (await ok()) return true;
      await pg.waitForTimeout(250);
    }
  }
  return false;
}

// ---------------------------------------------------------------- email confirmation handling + password rules (logged out)
G('email confirmation pages + password rules');
{
  const c = await newCtx(browser),
    q = await c.newPage();
  q.on('dialog', (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  globalThis.__page = q;
  await step('/verify without an address offers a "send a new link" form', async () => {
    await q.goto('/verify');
    const t = await body(q);
    return (await q.locator('input[name=email]').count()) === 1 && /Send a new link/.test(t) && /Confirm your email/.test(t)
      ? true
      : t.slice(0, 200);
  });
  await step('/verify?email= shows the address with a Resend button', async () => {
    await q.goto('/verify?email=' + encodeURIComponent('someone@example.com'));
    const t = await body(q);
    return /Check your email/.test(t) &&
      /someone@example\.com/.test(t) &&
      (await q.locator('button:has-text("Resend email")').count()) === 1
      ? true
      : t.slice(0, 200);
  });
  await step('/verify escapes hostile input (no script, no injected elements)', async () => {
    for (const h of ['"><svg/onload=alert(1)>@x.co', 'a<img src=x onerror=alert(1)>@x.co']) {
      await q.goto('/verify?email=' + encodeURIComponent(h));
      await q.waitForTimeout(400);
      if ((await q.locator('svg[onload], img[onerror]').count()) || dialogs.length) return h;
    }
    return true;
  });
  await step('resend for an unknown address gives a generic answer (no account enumeration)', async () => {
    await q.goto('/verify');
    await q.fill('input[name=email]', em('ghost'));
    await act(q, () => q.click('button:has-text("Send a new link")'));
    const f = await flash(q);
    return /If that address is waiting|Too many/.test(f) && !LEAK.test(f) && !/no account|not found|does not exist|doesn't exist/i.test(f)
      ? true
      : f;
  });
  await step('Content-Security-Policy lets "Continue with Google" redirect to Supabase and Google (and nowhere else)', async () => {
    const r = await q.goto('/login');
    const csp = r.headers()['content-security-policy'] ?? '';
    const fa = (csp.match(/form-action ([^;]+)/) ?? [])[1] ?? '';
    const list = fa.trim().split(/\s+/).sort().join(' ');
    return /^'self' https:\/\/accounts\.google\.com https:\/\/[a-z0-9]+\.supabase\.co$/.test(list) && !/\*/.test(fa) ? true : csp;
  });
  // Regression (2026-10-12): after a custom domain was attached, the site told Supabase to send Google back to that unfinished domain, so sign-in never completed.
  await step('"Continue with Google" asks Supabase to return to THIS site (never another domain)', async () => {
    const seen = [];
    const onReq = (r) => {
      if (/\.supabase\.co\/auth\/v1\/authorize/.test(r.url())) seen.push(r.url());
    };
    q.on('request', onReq);
    await q.goto('/login');
    await q.waitForTimeout(2500);
    await q.locator('button:has-text("Continue with Google")').click();
    await q.waitForTimeout(5000);
    q.off('request', onReq);
    if (!seen.length) return 'no authorize request was made';
    const to = new URL(seen[0]).searchParams.get('redirect_to') ?? '';
    return new URL(to).origin === new URL(BASE).origin && new URL(to).pathname === '/auth/callback' ? true : to;
  });
  await step('email-code login for an unknown address gives a generic answer, then a wrong code is refused plainly', async () => {
    await q.goto('/code');
    await q.fill('input[name=email]', em('ghostcode'));
    await act(q, () => q.click('button:has-text("Email me a code")'));
    const f = await flash(q);
    if (!(/login code is on its way|Too many/.test(f) && !LEAK.test(f) && !/no account|not found|does not exist/i.test(f))) return f;
    await q.fill('input[name=code]', '000000');
    await act(q, () => q.click('button:has-text("Log in")'));
    const g = await flash(q);
    return /wrong or has expired/.test(g) && !LEAK.test(g) && new URL(q.url()).pathname === '/code' ? true : g;
  });
  await step('/verify rejects a malformed address with a plain message', async () => {
    await q.goto('/verify');
    await q.fill('input[name=email]', 'nope');
    await q.evaluate(() => {
      document.querySelector('form').noValidate = true;
    });
    await act(q, () => q.click('button:has-text("Send a new link")'));
    const f = await flash(q);
    return /valid email/i.test(f) ? true : f;
  });
  await step('a bad confirmation link lands on /verify with guidance, not an error page', async () => {
    await q.goto('/auth/callback?code=bad&next=/&welcome=1');
    const f = await flash(q);
    return path(q) === '/verify' && /did not work/.test(f) && /log in/i.test(await body(q)) && !LEAK.test(f) ? true : [path(q), f];
  });
  await step('a bad reset link lands on /forgot', async () => {
    await q.goto('/auth/callback?code=bad&next=/reset');
    const f = await flash(q);
    return path(q) === '/forgot' && /invalid or has expired/.test(f) ? true : [path(q), f];
  });
  await step('open redirect through ?next= is ignored', async () => {
    await q.goto('/auth/callback?code=bad&next=' + encodeURIComponent('https://evil.example/x'));
    return new URL(q.url()).origin === new URL(BASE).origin ? true : q.url();
  });
  await step('an unsupported email-link type is refused safely', async () => {
    await q.goto('/auth/callback?token_hash=abc&type=magiclink');
    const f = await flash(q);
    return new URL(q.url()).origin === new URL(BASE).origin && f && !LEAK.test(f) ? true : [q.url(), f];
  });
  await step('register form asks for 8+ characters', async () => {
    await q.goto('/register');
    return (await q.locator('input[name=password]').getAttribute('placeholder')).includes('8+') &&
      (await q.locator('input[name=password]').getAttribute('minlength')) === '8'
      ? true
      : 'hint/minlength';
  });
  const bypass = () => q.evaluate(() => document.querySelectorAll('input[minlength]').forEach((i) => i.removeAttribute('minlength')));
  const tryReg = async (tag, pw) => {
    await q.goto('/register');
    await bypass();
    await q.fill('input[name=email]', em(tag));
    await q.fill('input[name=password]', pw);
    await act(q, () => q.click('button:has-text("Create account")'));
    return flash(q);
  };
  await step('server rejects a 7-character password even when the browser check is bypassed', async () => {
    const f = await tryReg('p7', 'abcd123');
    return /8 to 72/.test(f) && path(q) === '/register' ? true : f;
  });
  await step('server rejects a single repeated character', async () => {
    const f = await tryReg('rep', 'zzzzzzzzzz');
    return /too easy to guess/.test(f) ? true : f;
  });
  await step('server rejects a password found in a data breach (Have I Been Pwned, k-anonymity)', async () => {
    const f = await tryReg('pwn', 'password123');
    return /data breach/.test(f) && path(q) === '/register' ? true : f;
  });
  await step('a strong unique password is accepted', async () => {
    await q.goto('/register');
    await q.fill('input[name=email]', em('ok1'));
    await q.fill('input[name=password]', PW);
    await Promise.all([
      q.waitForURL((u) => new URL(u).pathname !== '/register', { timeout: 30000 }),
      q.click('button:has-text("Create account")'),
    ]);
    return path(q) === '/' ? true : path(q);
  });
  await c.close();
  globalThis.__page = p;
}

// ---------------------------------------------------------------- security page
G('security page: password + devices');
const A = em('a');
await step('sign up a fresh user and open /security', async () => {
  await signup(p, A, PW);
  await p.goto('/security');
  const t = await body(p);
  return path(p) === '/security' &&
    new RegExp(A).test(t) &&
    /Email (not )?confirmed/.test(t) &&
    /Two-step verification/.test(t) &&
    /Change password/.test(t)
    ? true
    : t.slice(0, 200);
});
await step('Settings links to Security and the Settings tab stays highlighted there', async () => {
  await p.goto('/settings');
  const l = await p.locator('a[href="/security"]').count();
  await p.goto('/security');
  const cur = await p.locator('a[aria-current=page]:visible').first().getAttribute('href');
  return l >= 1 && cur === '/settings' ? true : { l, cur };
});
const cpw = async (cur, pw, conf = pw) => {
  await p.goto('/security');
  const f = p.locator('form:has(input[name=current])');
  await f.locator('input[name=current]').fill(cur);
  await f.locator('input[name=password]').fill(pw);
  await f.locator('input[name=confirm]').fill(conf);
  await act(p, () => f.locator('button:has-text("Change password")').click());
  return flash(p);
};
await step('change password: wrong current password is refused', async () => {
  const f = await cpw('not-my-password-1', PW2);
  return /current password is not right/.test(f) && !LEAK.test(f) ? true : f;
});
await step('change password: mismatch is refused', async () => {
  const f = await cpw(PW, PW2, PW2 + 'y');
  return /do not match/.test(f) ? true : f;
});
await step('change password: same password is refused', async () => {
  const f = await cpw(PW, PW);
  return /different/.test(f) ? true : f;
});
await step('change password: breached password is refused', async () => {
  const f = await cpw(PW, 'password123');
  return /data breach/.test(f) ? true : f;
});
await step('change password: 7 characters refused by the server', async () => {
  await p.goto('/security');
  await p.evaluate(() => document.querySelectorAll('input[minlength]').forEach((i) => i.removeAttribute('minlength')));
  const f0 = p.locator('form:has(input[name=current])');
  await f0.locator('input[name=current]').fill(PW);
  await f0.locator('input[name=password]').fill('abcd123');
  await f0.locator('input[name=confirm]').fill('abcd123');
  await act(p, () => f0.locator('button:has-text("Change password")').click());
  const f = await flash(p);
  return /8 to 72/.test(f) ? true : f;
});
// a second device, logged in before the change
const consoleLog = [];
p.on('console', (m) => {
  if (/error|warn/.test(m.type())) consoleLog.push(m.type() + ': ' + m.text().slice(0, 200));
});
p.on('requestfailed', (r) => consoleLog.push('requestfailed: ' + r.url().replace(BASE, '') + ' ' + (r.failure()?.errorText ?? '')));
p.on('pageerror', (e) => consoleLog.push('pageerror: ' + e.message.slice(0, 200)));
const c2 = await newCtx(browser),
  p2 = await c2.newPage();
await step('second device is logged in', async () => {
  await login(p2, A, PW);
  return path(p2) === '/' ? true : path(p2);
});
await step('change password: success keeps this device and logs out the other', async () => {
  const f = await cpw(PW, PW2);
  if (!/Password changed/.test(f) || path(p) !== '/security') {
    const mainLen = await p.evaluate(() => document.querySelector('main')?.innerHTML.length ?? -1);
    await p.reload();
    const after = await flash(p).catch(() => '');
    return { f, path: path(p), mainLen, afterReload: (await body(p)).slice(0, 120), after, consoleLog: consoleLog.slice(-8) };
  }
  await p2.goto('/transactions');
  return path(p2) === '/login' ? true : 'other device still logged in: ' + path(p2);
});
await step('change password: the new password works, the old one does not', async () => {
  await logout(p);
  await login(p, A, PW);
  const o = path(p);
  await login(p, A, PW2);
  return o === '/login' && path(p) === '/' ? true : { old: o, new: path(p) };
});
const c3 = await newCtx(browser),
  p3 = await c3.newPage();
await step('"Log out other devices" ends other sessions and keeps this one', async () => {
  await login(p3, A, PW2);
  await p.goto('/security');
  await act(p, () => p.click('button:has-text("Log out other devices")'));
  const f = await flash(p);
  await p3.goto('/');
  return /other device/i.test(f) && path(p) === '/security' && path(p3) === '/login' ? true : { f, p: path(p), p3: path(p3) };
});
await step('"Log out everywhere" ends this session too', async () => {
  await p.goto('/security');
  await Promise.all([p.waitForURL(/\/login/, { timeout: 20000 }), p.click('button:has-text("Log out everywhere")')]);
  const f = await flash(p);
  await p.goto('/');
  return /every device/i.test(f) && path(p) === '/login' ? true : { f, p: path(p) };
});
await c2.close();
await c3.close();

// ---------------------------------------------------------------- two-step verification in the browser
G('two-step verification (authenticator app)');
const M = em('m');
let secret = '';
await step('sign up; the setup shows a QR image and a typeable key', async () => {
  await signup(p, M, PW);
  await p.goto('/security');
  await p.click('button:has-text("Set up two-step verification")');
  await p.locator('img[alt^="QR code"]').waitFor({ timeout: 15000 });
  const src = await p.locator('img[alt^="QR code"]').getAttribute('src');
  secret = (await p.locator('code.key').innerText()).trim();
  const nat = await p.locator('img[alt^="QR code"]').evaluate((i) => i.complete && i.naturalWidth > 0);
  return /^data:image\/svg\+xml/.test(src) && /^[A-Z2-7]{16,}$/.test(secret) && nat ? true : { src: src.slice(0, 40), secret, nat };
});
await step('setup: a wrong code is refused and 2FA stays off', async () => {
  await p.locator('input[aria-label="6-digit code from your app"]').fill('000000');
  await p.locator('.flash.bad').waitFor({ timeout: 10000 });
  const t = await body(p);
  await p.reload();
  return /code is not right/.test(t) && /Off/.test(await p.locator('.badge').last().innerText()) ? true : t.slice(0, 200);
});
await step('setup: the right code turns it on', async () => {
  await p.click('button:has-text("Set up two-step verification")');
  await p.locator('code.key').waitFor({ timeout: 15000 });
  secret = (await p.locator('code.key').innerText()).trim();
  const ok = await enter(
    p,
    'input[aria-label="6-digit code from your app"]',
    secret,
    async () => (await p.locator('.badge.on', { hasText: /^On$/ }).count()) > 0,
  );
  return ok ? true : (await body(p)).slice(0, 300);
});
await step('log out and in: the password alone only reaches the code screen', async () => {
  await logout(p);
  await login(p, M, PW);
  const t = await body(p);
  return path(p) === '/2fa' && /Enter your code/.test(t) && !/Total balance/.test(t) ? true : [path(p), t.slice(0, 120)];
});
await step('while only the password is verified, every app page redirects to /2fa', async () => {
  const out = [];
  for (const r of ['/', '/transactions', '/accounts', '/budgets', '/reports', '/assistant', '/settings', '/export']) {
    const res = await ctx.request.get(r, { maxRedirects: 0 });
    const loc = res.headers()['location'] || '';
    if (!(res.status() >= 300 && res.status() < 400 && /\/2fa/.test(loc))) out.push(r + ':' + res.status());
  }
  await p.goto('/security');
  const sp = path(p) + new URL(p.url()).search;
  if (!sp.startsWith('/2fa?next=')) out.push('security->' + sp);
  return out.length ? out : true;
});
await step('a wrong code is refused with a plain message', async () => {
  await p.goto('/2fa');
  await p.locator('input[name=code]').fill('111111');
  await p.locator('.flash.bad').waitFor({ timeout: 10000 });
  const f = await flash(p);
  return /code is not right/.test(f) && path(p) === '/2fa' && !LEAK.test(f) ? true : f;
});
await step('the right code finishes log-in and lands on the dashboard', async () => {
  await p.goto('/2fa');
  const ok = await enter(p, 'input[name=code]', secret, async () => path(p) === '/');
  return ok && /Total balance/.test(await body(p)) ? true : [path(p), await flash(p)];
});
await step('/2fa is not reachable once fully signed in', async () => {
  await p.goto('/2fa');
  return path(p) === '/' ? true : path(p);
});
await step('the security page shows 2FA as On and never shows the setup key again', async () => {
  await p.goto('/security');
  const t = await body(p);
  return /On/.test(await p.locator('.badge').nth(1).innerText()) && !t.includes(secret) && (await p.locator('code.key').count()) === 0
    ? true
    : t.slice(0, 200);
});
await step('reset-password route is also gated by the code', async () => {
  const c = await newCtx(browser),
    q = await c.newPage();
  await login(q, M, PW);
  await q.goto('/reset');
  const u = path(q) + new URL(q.url()).search;
  await c.close();
  return u.startsWith('/2fa?next=') ? true : u;
});
await step('turning it off needs a valid code', async () => {
  await p.goto('/security');
  await p.locator('input[aria-label="6-digit code to turn off"]').fill('000000');
  await act(p, () => p.click('button:has-text("Turn off")'));
  const f = await flash(p);
  return /code is not right/.test(f) && (await p.locator('.badge').nth(1).innerText()) === 'On' ? true : f;
});
await step('turning it off with the right code works', async () => {
  const ok = await enter(
    p,
    'input[aria-label="6-digit code to turn off"]',
    secret,
    async () =>
      /Two-step verification is off/.test(
        await p
          .locator('.flash')
          .allInnerTexts()
          .then((a) => a.join(' '))
          .catch(() => ''),
      ),
    { click: 'button:has-text("Turn off")' },
  );
  return ok ? true : await flash(p);
});
await step('after turning it off, log-in goes straight to the dashboard', async () => {
  await logout(p);
  await login(p, M, PW);
  return path(p) === '/' ? true : path(p);
});

// ---------------------------------------------------------------- DB-level enforcement (migration 0006)
G('two-step verification is enforced by the database (migration 0006)');
{
  const anon = mk();
  const mkUser = async (tag) => {
    const c = mk(),
      { data, error } = await c.auth.signUp({ email: em(tag), password: PW });
    if (error || !data.session) throw new Error('signUp: ' + (error?.message || 'no session'));
    return { c, id: data.user.id, email: em(tag) };
  };
  const U = await mkUser('d'),
    V = await mkUser('v');
  let sec = '',
    fid = '';
  const n = async (c, t = 'accounts') => {
    const r = await c.from(t).select('*', { count: 'exact', head: true }); // a head count works for every table (user_settings has no id column)
    return r.error ? 'ERR:' + r.error.code : r.count;
  };
  await step('mfa_ok() exists: callable by signed-in users, not by anonymous', async () => {
    const a = await U.c.rpc('mfa_ok'),
      b = await anon.rpc('mfa_ok');
    return a.data === true && b.error ? true : { a: a.data ?? a.error?.message, b: b.error?.message ?? b.data };
  });
  await step('without 2FA the user reads and writes normally', async () => {
    return (await n(U.c)) === 6 ? true : await n(U.c);
  });
  await step('enrol a real authenticator factor and verify it (session becomes aal2)', async () => {
    const e = await U.c.auth.mfa.enroll({ factorType: 'totp', issuer: 'Zovix', friendlyName: 'qa' });
    if (e.error) return e.error.message;
    fid = e.data.id;
    sec = e.data.totp.secret;
    for (const s of [0, 1, -1]) {
      const ch = await U.c.auth.mfa.challenge({ factorId: fid });
      const v = await U.c.auth.mfa.verify({ factorId: fid, challengeId: ch.data.id, code: totp(sec, s) });
      if (!v.error) {
        const a = await U.c.auth.mfa.getAuthenticatorAssuranceLevel();
        return a.data.currentLevel === 'aal2' ? true : a.data;
      }
    }
    return 'no code accepted';
  });
  await step('aal2 session still reads its data', async () => ((await n(U.c)) === 6 ? true : await n(U.c)));
  // Every table below gets ONE real row for U while U is aal2, so "aal1 sees 0 rows" and "aal1 changes 0 rows" can only pass if the policy really hides/blocks them.
  const PROT = [
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'recurring_transactions',
    'savings_goals',
    'user_settings',
    'profiles',
    'tx_trash',
  ];
  const pk = (t) => (t === 'user_settings' ? 'user_id' : t === 'profiles' ? 'id' : 'id');
  const patch = {
    accounts: { name: 'Hacked' },
    categories: { name: 'Hacked' },
    transactions: { description: 'Hacked' },
    budgets: { amount_minor: 999 },
    recurring_transactions: { amount_minor: 999 },
    savings_goals: { name: 'Hacked' },
    user_settings: { layout: { hacked: true } },
    profiles: { name: 'Hacked' },
  };
  const keep = {}; // table -> primary key value of the seeded row
  await step('seed one row in every protected table for U (aal2), including a trash row, so the aal1 checks below can fail', async () => {
    const acct = (await U.c.from('accounts').select('id').order('sort_order').limit(1)).data?.[0]?.id,
      cat = (await U.c.from('categories').select('id').eq('type', 'expense').order('sort_order').limit(1)).data?.[0]?.id;
    if (!acct || !cat) return 'no default account/category for U';
    const tx = (d) => ({
      user_id: U.id,
      type: 'expense',
      category_id: cat,
      account_id: acct,
      amount_minor: 1234,
      transaction_date: '2020-01-15',
      description: d,
    });
    const t1 = await U.c.from('transactions').insert(tx('QA-AAL1-keep')).select('id').single(),
      t2 = await U.c.from('transactions').insert(tx('QA-AAL1-trash')).select('id').single();
    if (t1.error || t2.error) return { tx: t1.error?.message ?? t2.error?.message };
    const del = await U.c.from('transactions').delete().eq('id', t2.data.id); // the delete trigger writes the tx_trash row
    const bu = await U.c
        .from('budgets')
        .insert({ user_id: U.id, category_id: cat, amount_minor: 5000, month: 3, year: 2020 })
        .select('id')
        .single(),
      rc = await U.c
        .from('recurring_transactions')
        .insert({
          user_id: U.id,
          account_id: acct,
          category_id: cat,
          type: 'expense',
          amount_minor: 1000,
          description: 'QA-AAL1',
          interval_count: 1,
          frequency: 'daily',
          start_date: '2020-01-01',
          next_run_date: '2020-01-01',
        })
        .select('id')
        .single(),
      sg = await U.c.from('savings_goals').insert({ user_id: U.id, name: 'QA-AAL1', target_minor: 1000 }).select('id').single(),
      us = await U.c
        .from('user_settings')
        .upsert({ user_id: U.id, layout: { qa: 1 } })
        .select('user_id')
        .single();
    const err = [del, bu, rc, sg, us].find((x) => x.error);
    if (err) return err.error.message;
    keep.transactions = t1.data.id;
    keep.budgets = bu.data.id;
    keep.recurring_transactions = rc.data.id;
    keep.savings_goals = sg.data.id;
    keep.user_settings = us.data.user_id;
    keep.accounts = acct;
    keep.categories = cat;
    keep.profiles = U.id;
    keep.tx_trash = (await U.c.from('tx_trash').select('id').limit(1)).data?.[0]?.id;
    const seen = {};
    for (const t of PROT) seen[t] = await n(U.c, t);
    return PROT.every((t) => keep[t] && typeof seen[t] === 'number' && seen[t] >= 1) ? true : { keep: Object.keys(keep), seen };
  });
  await step('a fresh password-only (aal1) session reads 0 rows from every table, although each one holds a row', async () => {
    await U.c.auth.signOut();
    const s = await U.c.auth.signInWithPassword({ email: U.email, password: PW });
    if (s.error) return s.error.message;
    const a = await U.c.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!(a.data.currentLevel === 'aal1' && a.data.nextLevel === 'aal2')) return a.data;
    const out = {};
    for (const t of PROT) out[t] = await n(U.c, t);
    return Object.values(out).every((v) => v === 0) ? true : out;
  });
  await step('aal1 cannot update or delete those rows (0 rows affected or 42501), in every table', async () => {
    const bad = {};
    for (const t of PROT) {
      const col = pk(t);
      if (patch[t]) {
        const u = await U.c.from(t).update(patch[t]).eq(col, keep[t]).select(col);
        if (!(u.error ? u.error.code === '42501' : (u.data ?? []).length === 0)) bad[t + ' update'] = u.error?.code ?? u.data.length;
      }
      const d = await U.c.from(t).delete({ count: 'exact' }).eq(col, keep[t]);
      if (!(d.error ? d.error.code === '42501' : d.count === 0)) bad[t + ' delete'] = d.error?.code ?? d.count;
    }
    return Object.keys(bad).length === 0 ? true : bad;
  });
  await step('aal1 cannot write either (insert is rejected)', async () => {
    const r = await U.c.from('accounts').insert({ user_id: U.id, name: 'Sneaky', account_type: 'cash' });
    const c2 = await U.c.from('categories').insert({ user_id: U.id, name: 'Sneaky', type: 'expense' });
    return r.error && c2.error ? true : { a: r.error?.code ?? 'NO_ERROR', c: c2.error?.code ?? 'NO_ERROR' };
  });
  await step('aal1 gets nothing from the aggregate functions either', async () => {
    const r = await U.c.rpc('period_summary', { p_from: '2000-01-01', p_to: '2100-01-01' }),
      b = await U.c.rpc('account_balances');
    return (r.error || (r.data ?? []).length === 0) && (b.error || (b.data ?? []).length === 0)
      ? true
      : { r: r.data?.length, b: b.data?.length };
  });
  await step('after the code is entered the same session reads everything again', async () => {
    const f = (await U.c.auth.mfa.listFactors()).data.totp[0];
    for (const s of [0, 1, -1]) {
      const ch = await U.c.auth.mfa.challenge({ factorId: f.id });
      const v = await U.c.auth.mfa.verify({ factorId: f.id, challengeId: ch.data.id, code: totp(sec, s) });
      if (!v.error) return (await n(U.c)) === 6 ? true : await n(U.c);
    }
    return 'no code accepted';
  });
  await step('after the code, the seeded rows are all still there and unchanged (the aal1 update/delete did nothing)', async () => {
    const bad = {};
    for (const t of PROT) {
      const r = await U.c.from(t).select('*').eq(pk(t), keep[t]);
      if (r.error || (r.data ?? []).length !== 1) bad[t] = r.error?.code ?? (r.data ?? []).length;
      else if (patch[t] && Object.entries(patch[t]).some(([k, v]) => JSON.stringify(r.data[0][k]) === JSON.stringify(v)))
        bad[t] = 'CHANGED';
    }
    return Object.keys(bad).length === 0 ? true : bad;
  });
  await step('another user without 2FA is unaffected', async () => ((await n(V.c)) === 6 ? true : await n(V.c)));
  await step('removing the factor restores plain password access', async () => {
    const u = await U.c.auth.mfa.unenroll({ factorId: fid });
    if (u.error) return u.error.message;
    await U.c.auth.signOut();
    const s = await U.c.auth.signInWithPassword({ email: U.email, password: PW });
    return !s.error && (await n(U.c)) === 6 ? true : (s.error?.message ?? (await n(U.c)));
  });
  await step('cleanup: the seeded rows are deleted and read back as 0', async () => {
    const bad = {};
    // transactions BEFORE tx_trash (deleting a transaction writes a trash row); user_settings has no delete policy, so it is not part of the clean-up
    for (const t of ['transactions', 'tx_trash', 'budgets', 'recurring_transactions', 'savings_goals']) {
      const d = await U.c.from(t).delete().eq('user_id', U.id);
      const left = await n(U.c, t);
      if (d.error || left !== 0) bad[t] = d.error?.message ?? left;
    }
    return Object.keys(bad).length === 0 ? true : bad;
  });
}

// ---------------------------------------------------------------- native app account deletion (POST /api/native/delete-account)
// The route ships in the same merge that deploys it and prod-qa runs after the deploy, so every step here is a real check: a 404 fails the run.
// Only accounts created by this block are ever deleted.
G('native app: delete account (/api/native/delete-account)');
{
  const EP = BASE + '/api/native/delete-account';
  const call = async (token, body, headers = {}) => {
    const r = await fetch(EP, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
      body: JSON.stringify(body),
    });
    return { s: r.status, j: await r.json().catch(() => null), cc: r.headers.get('cache-control') };
  };
  // The route ships in the same merge that deploys it, and prod-qa runs after the deploy, so a 404 here means it is broken, renamed or blocked: that FAILS (no skipping).
  const ds = step;
  const signedIn = async (u) => {
    const c = mk(),
      s = await c.auth.signInWithPassword({ email: u.email, password: PW });
    if (s.error || !s.data.session) throw new Error('sign-in: ' + (s.error?.message || 'no session'));
    return { c, token: s.data.session.access_token };
  };
  const stillExists = async (u) => !(await mk().auth.signInWithPassword({ email: u.email, password: PW })).error;
  const mkU = async (tag) => {
    const { data, error } = await mk().auth.signUp({ email: em(tag), password: PW });
    if (error || !data.user) throw new Error('signUp: ' + (error?.message || 'no user'));
    const u = { id: data.user.id, email: em(tag) };
    return { ...u, ...(await signedIn(u)) }; // a fresh sign-in, so the token carries the sign-in time the route checks
  };
  const accts = async (c) => {
    const r = await c.from('accounts').select('id');
    return r.error ? 'ERR:' + r.error.code : r.data.length;
  };
  let C,
    T2,
    A2,
    B2,
    sec2 = '',
    fid2 = '';
  const verifyCode = async (c, factorId) => {
    for (const s of [0, 1, -1]) {
      const ch = await c.auth.mfa.challenge({ factorId });
      const v = await c.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: totp(sec2, s) });
      if (!v.error) return true;
    }
    return false;
  };

  await ds('delete-account: no Authorization header is refused with 401', async () => {
    const r = await call(null, { confirm: 'DELETE' });
    return r.s === 401 && typeof r.j?.error === 'string' && !LEAK.test(r.j.error) ? true : r;
  });
  await ds('delete-account: a garbage bearer token is refused with 401 (also a wrong scheme)', async () => {
    const out = [];
    for (const [tok, hdr] of [
      ['not-a-token', {}],
      ['aaa.bbb.ccc', {}],
      [null, { Authorization: 'Basic dXNlcjpwdw==' }],
    ]) {
      const r = await call(tok, { confirm: 'DELETE' }, hdr);
      if (r.s !== 401 || LEAK.test(String(r.j?.error))) out.push({ tok, s: r.s });
    }
    return out.length ? out : true;
  });
  await ds('delete-account: set up four throwaway users (plain, two-step, A, B) with fresh sign-ins', async () => {
    [C, T2, A2, B2] = await Promise.all([mkU('x1'), mkU('x2'), mkU('x3'), mkU('x4')]);
    const e = await T2.c.auth.mfa.enroll({ factorType: 'totp', issuer: 'Zovix', friendlyName: 'qa' });
    if (e.error) return e.error.message;
    fid2 = e.data.id;
    sec2 = e.data.totp.secret;
    if (!(await verifyCode(T2.c, fid2))) return 'no authenticator code accepted';
    const T3 = await signedIn(T2); // password-only again: this token is aal1
    T2.aal1 = T3.token;
    const a = await T3.c.auth.mfa.getAuthenticatorAssuranceLevel();
    return a.data?.currentLevel === 'aal1' && a.data?.nextLevel === 'aal2' && (await accts(C.c)) > 0 ? true : a.data;
  });
  await ds(
    'delete-account: a valid fresh token with confirm missing, "delete" or "DELETE ME" gets 400 and the user still exists',
    async () => {
      const out = [];
      for (const b of [{}, { confirm: 'delete' }, { confirm: 'DELETE ME' }, { confirm: 123 }]) {
        const r = await call(C.token, b);
        if (r.s !== 400 || typeof r.j?.error !== 'string') out.push({ b, s: r.s });
      }
      return out.length ? out : (await stillExists(C)) && (await accts(C.c)) > 0 ? true : 'user was deleted by a rejected request';
    },
  );
  await ds('delete-account: a two-step user with a password-only (aal1) token gets 403 and the user still exists', async () => {
    const r = await call(T2.aal1, { confirm: 'DELETE' });
    return r.s === 403 && typeof r.j?.error === 'string' && (await stillExists(T2)) ? true : r;
  });
  await ds(
    "delete-account: user B deleting itself leaves user A signed in with A's data intact (the token decides who is deleted)",
    async () => {
      const before = await accts(A2.c);
      const r = await call(B2.token, { confirm: 'DELETE', userId: A2.id, user_id: A2.id }); // a user id in the body must be ignored
      if (r.s !== 200 || r.j?.ok !== true) return r;
      const g = await mk().auth.getUser(A2.token);
      return !g.error && g.data.user?.id === A2.id && (await stillExists(A2)) && (await accts(A2.c)) === before && before > 0
        ? true
        : { getUser: g.error?.message, before, after: await accts(A2.c) };
    },
  );
  await ds(
    "delete-account: B's token is dead afterwards (getUser, sign-in and the data are gone) and a second call returns 401",
    async () => {
      const g = await mk().auth.getUser(B2.token);
      const s = await mk().auth.signInWithPassword({ email: B2.email, password: PW });
      const rows = await accts(B2.c);
      const again = await call(B2.token, { confirm: 'DELETE' });
      return g.error && s.error && (rows === 0 || String(rows).startsWith('ERR:')) && again.s === 401
        ? true
        : { getUser: g.error?.message ?? 'still valid', signIn: s.error?.message ?? 'still works', rows, again: again.s };
    },
  );
  await ds(
    'delete-account: a fresh token with confirm DELETE returns 200; the account, its token and its rows are gone; a repeat is 401',
    async () => {
      const r = await call(C.token, { confirm: 'DELETE' });
      if (r.s !== 200 || r.j?.ok !== true || !/no-store/.test(r.cc ?? '')) return r;
      const g = await mk().auth.getUser(C.token);
      const s = await mk().auth.signInWithPassword({ email: C.email, password: PW });
      const rows = await accts(C.c);
      const again = await call(C.token, { confirm: 'DELETE' });
      return g.error && s.error && (rows === 0 || String(rows).startsWith('ERR:')) && again.s === 401
        ? true
        : { getUser: g.error?.message ?? 'still valid', signIn: s.error?.message ?? 'still works', rows, again: again.s };
    },
  );
  await ds(
    'delete-account: after the code is entered (aal2) the two-step user can delete itself; the last throwaway users are cleaned up',
    async () => {
      const f = (await T2.c.auth.mfa.listFactors()).data?.totp?.[0];
      if (!f) return 'no factor';
      const s = await signedIn(T2);
      if (!(await verifyCode(s.c, f.id))) return 'no authenticator code accepted';
      const tok = (await s.c.auth.getSession()).data.session?.access_token;
      const r = await call(tok, { confirm: 'DELETE' });
      const gone = r.s === 200 && !(await stillExists(T2));
      const rA = await call((await signedIn(A2)).token, { confirm: 'DELETE' }); // A2 was created by this block as well
      return gone && rA.s === 200 ? true : { two: r.s, a2: rA.s, gone };
    },
  );
}

// ---------------------------------------------------------------- loading skeletons
G('loading skeletons');
const S = await newCtx(browser),
  q = await S.newPage();
globalThis.__page = q;
await login(q, A, PW2).catch(() => {}); // A's sessions were all ended above; log in again
const ROUTES = ['/', '/transactions', '/accounts', '/budgets', '/reports', '/settings', '/security']; // /assistant has no data to wait for, so it renders at once
await step('every page streams its skeleton first, then the real content (full page load)', async () => {
  const bad = [];
  for (const r of ROUTES) {
    const res = await S.request.get(r);
    const h = await res.text();
    const i = h.indexOf('data-skeleton');
    if (res.status() !== 200 || i < 0 || !/aria-busy="true"/.test(h) || !/role="status"/.test(h))
      bad.push(r + ':' + res.status() + ':' + i);
  }
  return bad.length ? bad : true;
});
await step('the app shell (nav) is in the same first response as the skeleton', async () => {
  const h = await (await S.request.get('/transactions')).text();
  return h.indexOf('aria-label="Main"') > -1 && h.indexOf('aria-label="Main"') < h.indexOf('data-skeleton')
    ? true
    : [h.indexOf('aria-label="Main"'), h.indexOf('data-skeleton')];
});
await step('navigating with slow data: the sidebar stays and a skeleton fills the page immediately', async () => {
  await q.goto('/');
  await q.waitForSelector('text=Total balance');
  await q.waitForTimeout(2500); // let links prefetch their loading shells
  await q.route('**/*', async (route) => {
    const h = route.request().headers();
    if (h['rsc'] === '1' && !h['next-router-prefetch']) await new Promise((r) => setTimeout(r, 3500));
    await route.continue();
  });
  await q.locator('a.nl[href="/transactions"]:visible').first().click();
  const t0 = Date.now();
  await q.locator('[data-skeleton]').first().waitFor({ state: 'visible', timeout: 2500 });
  const ms = Date.now() - t0;
  const nav = await q.locator('aside.side').isVisible(),
    shapes = await q.locator('[data-skeleton] .sk').count();
  await q.locator('form[aria-label=Filters]').waitFor({ timeout: 15000 });
  await q.waitForTimeout(300);
  const gone = (await q.locator('[data-skeleton]').count()) === 0;
  await q.unroute('**/*');
  return nav && shapes >= 8 && gone && ms < 2500 && path(q) === '/transactions' ? true : { nav, shapes, gone, ms, p: path(q) };
});
await step('the skeleton has an accessible name and the real page replaces it', async () => {
  const b = await q.evaluate(() => !!document.querySelector('[data-skeleton]'));
  return b === false && (await q.locator('form[aria-label=Filters]').count()) === 1 ? true : 'skeleton lingered';
});
await step('skeleton animation stops for people who prefer reduced motion', async () => {
  const a = async () =>
    q.evaluate(() => {
      const e = document.createElement('span');
      e.className = 'sk';
      document.body.appendChild(e);
      const n = getComputedStyle(e).animationName;
      e.remove();
      return n;
    });
  await q.emulateMedia({ reducedMotion: 'no-preference' });
  const on = await a();
  await q.emulateMedia({ reducedMotion: 'reduce' });
  const off = await a();
  await q.emulateMedia({ reducedMotion: 'no-preference' });
  return /shimmer/.test(on) && off === 'none' ? true : { on, off };
});
{
  const Mb = await newCtx(browser, { width: 390, height: 844 }),
    m = await Mb.newPage();
  globalThis.__page = m;
  await step('mobile: tab bar stays while the skeleton shows, with no sideways scroll', async () => {
    await login(m, A, PW2);
    await m.goto('/');
    await m.waitForSelector('text=Total balance');
    await m.waitForTimeout(2500);
    await m.route('**/*', async (route) => {
      const h = route.request().headers();
      if (h['rsc'] === '1' && !h['next-router-prefetch']) await new Promise((r) => setTimeout(r, 3500));
      await route.continue();
    });
    await m.locator('nav.tabs a[href="/reports"]').click();
    await m.locator('[data-skeleton]').first().waitFor({ state: 'visible', timeout: 2500 });
    const tabs = await m.locator('nav.tabs').isVisible(),
      ov = await overflow(m);
    await m.waitForSelector('text=Spending by category', { timeout: 15000 });
    await m.unroute('**/*');
    return tabs && ov <= 0 ? true : { tabs, ov };
  });
  for (const r of ['/security', '/verify?email=someone@example.com', '/verify', '/login', '/register', '/forgot', '/code'])
    await step(`mobile 390px: ${r} fits the screen`, async () => {
      await m.goto(r.startsWith('/security') ? r : r);
      await m.waitForTimeout(400);
      const ov = await overflow(m);
      return ov <= 0 ? true : ov;
    });
  await step('mobile 390px: the 2FA setup (QR + key) fits the screen', async () => {
    await m.goto('/security');
    await m.click('button:has-text("Set up two-step verification")');
    await m.locator('code.key').waitFor({ timeout: 15000 });
    const ov = await overflow(m);
    const qr = await m.locator('.qr').boundingBox();
    await m.reload();
    return ov <= 0 && qr && qr.width >= 150 ? true : { ov, qr };
  });
  await Mb.close();
}
await S.close();
const out = done({ users: [A, M, em('d'), em('v'), em('x1'), em('x2'), em('x3'), em('x4')] });
await browser.close();
process.exit(out.fail ? 1 : 0);
