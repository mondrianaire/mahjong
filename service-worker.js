/* M1 — service worker: cache the app shell + engine for FULL offline study use.
 * Cache-first for shell assets (they're versioned by CACHE name); network fallback.
 */
/* Cache name is tied to the app VERSION below — bump it on every code change so
 * returning devices discard the stale cache and re-fetch the shell. Keep VERSION
 * in sync with version.js / package.json. */
const VERSION = '1.0.1';
const CACHE = 'charleston-lab-' + VERSION;
const SHELL = [
  './app.mobile.html',
  './app.js',
  './tilefaces.js',
  './version.js',
  './dist/charleston-engine.global.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./app.mobile.html')))
  );
});
