// Public, read-only diagnostics. Never prints keys or data: only booleans, status codes and the deployed commit.
export const dynamic = 'force-dynamic';
const role = (jwt: string) => { try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role as string; } catch { return 'unreadable'; } };
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const keyKind = !key ? 'missing' : key.startsWith('sb_publishable_') ? 'publishable (ok)' : key.startsWith('sb_secret_') ? 'SECRET KEY - WRONG, rotate it now' : key.startsWith('eyJ') ? (role(key) === 'anon' ? 'legacy anon (ok)' : `legacy ${role(key)} - WRONG, rotate it now`) : 'unrecognised';
  const checks: Record<string, unknown> = {};
  const probe = async (name: string, path: string) => { try { const r = await fetch(url.replace(/\/$/, '') + path, { headers: { apikey: key }, cache: 'no-store' }); const body = await r.text(); let rows: number | undefined; try { const j = JSON.parse(body); rows = Array.isArray(j) ? j.length : undefined; } catch { /* not json */ } checks[name] = { status: r.status, rows }; } catch (e) { checks[name] = { error: (e as Error).message }; } };
  if (url && key) { await probe('auth_health', '/auth/v1/health'); for (const t of ['transactions', 'accounts', 'categories', 'budgets', 'recurring_transactions', 'profiles']) await probe('anon_read_' + t, `/rest/v1/${t}?select=id&limit=1`); }
  const anon = Object.entries(checks).filter(([k]) => k.startsWith('anon_read_')).map(([, v]: any) => v);
  const ok = !!url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && keyKind.includes('(ok)') && (checks.auth_health as any)?.status === 200 && anon.length > 0 && anon.every((v: any) => v.status === 200 && v.rows === 0);
  return Response.json({ ok, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'n/a', branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'n/a', region: process.env.VERCEL_REGION ?? 'n/a', env: { NEXT_PUBLIC_SUPABASE_URL: !!url, urlShapeOk: /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: !!key, keyKind, QA_TOKEN_set: (process.env.QA_TOKEN ?? '').length >= 16 }, hint: 'anon_read_* must be status 200 with rows 0 (tables exist, RLS hides everything). 404 = migrations not applied; 401 = wrong key; rows>0 = RLS NOT working.', checks }, { headers: { 'cache-control': 'no-store' } });
}
