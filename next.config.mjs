// Financial data must never be cached by browsers/proxies; pages are per-user. Static assets keep Next's immutable caching.
const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // form-action also covers the redirects that follow a form post. "Continue with Google" posts to this site, which redirects to Supabase and then Google, so exactly those two origins must be allowed or Chrome blocks the sign-in (seen on Android).
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://vxhgkkzbmrhxayzryake.supabase.co https://accounts.google.com; object-src 'none'",
  },
];
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser remembers a visited screen in memory for 30 seconds, so switching tabs in the app is instant. Memory only (never on disk, gone when the app closes).
  // Every save, delete, login and logout calls revalidatePath('/', 'layout') (see actions/shared.ts `done`), which wipes this memory, so nothing shown can be stale or belong to a previous user.
  // tests/app.test.ts fails if a mutating action stops calling done() or if this value is raised.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/zovix.apk', headers: [{ key: 'Content-Type', value: 'application/vnd.android.package-archive' }] }, // the Android app, public download
      { source: '/((?!_next/static|_next/image|favicon.ico).*)', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }] },
      // The landing page is the same for everyone and prerendered, so the CDN may keep direct /welcome visits (the middleware still runs on every request and redirects signed-in users first).
      { source: '/welcome', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' }] },
    ];
  },
};
export default nextConfig;
