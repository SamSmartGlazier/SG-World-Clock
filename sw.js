/*
  sw.js — the "service worker". It saves a copy of the app's files so
  it opens instantly and works offline, and it's what lets Edge/Chrome
  offer "Install as app".

  When you change any file, bump CACHE_VERSION (e.g. v2) so everyone's
  copy refreshes. Each open checks for updates in the background.
*/
const CACHE_VERSION = 'wc-v1';
const FILES = [
  './', 'index.html', 'styles.css', 'tz.js', 'cities.js', 'app.js',
  'team-defaults.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates arrive), falling back to the saved copy offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
