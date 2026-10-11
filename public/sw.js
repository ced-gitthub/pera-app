// Zovix service worker. It does ONE thing: when the phone is offline, show a friendly page instead of the browser error.
// It never stores pages, money data or API responses (financial data must not be cached on the device).
const CACHE = 'zovix-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // Navigation preload: the page request starts while the worker wakes up, so installed-app launches and taps are not delayed by the worker.
  e.waitUntil(
    Promise.all([
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : null,
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
    ]).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return; // everything else goes straight to the network
  e.respondWith(
    (async () => {
      try {
        return (await e.preloadResponse) || (await fetch(e.request));
      } catch {
        return caches.match(OFFLINE);
      }
    })(),
  );
});
