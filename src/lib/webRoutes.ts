// What the website serves once the tracker is retired (webAppEnabled() === false). Pure, so it is unit-tested.
// Allowlist, not denylist: a route that is not listed here is a retired tracker route and goes to the landing page.
export type LandingOnly = { kind: 'landing' } | { kind: 'public' } | { kind: 'session' } | { kind: 'redirect'; to: string };
const PUBLIC = ['/privacy', '/api/health', '/offline.html'];
// Needed while the native app has no screens of its own for them: the email-link callback (confirm email, reset), the recovery pages,
// and the data export (works for a session that already exists; there is no login page any more).
const SESSION = ['/auth/', '/forgot', '/verify', '/reset', '/export', '/2fa'];
export function landingOnlyRoute(path: string): LandingOnly {
  if (path === '/') return { kind: 'landing' };
  if (PUBLIC.some((p) => path === p || path.startsWith(p + '/'))) return { kind: 'public' };
  if (SESSION.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(p + '/')))) return { kind: 'session' };
  return { kind: 'redirect', to: '/' };
}
