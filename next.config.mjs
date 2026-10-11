// Financial data must never be cached by browsers/proxies; pages are per-user. Static assets keep Next's immutable caching.
const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
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
      { source: '/((?!_next/static|_next/image|favicon.ico).*)', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }] },
    ];
  },
};
export default nextConfig;
