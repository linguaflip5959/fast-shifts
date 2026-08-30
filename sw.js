const CACHE_NAME = 'fast-shifts-v1';
const urlsToCache = ['/', '/index.html', '/style.css', '/script.js', '/jobs.json', '/icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.endsWith('/jobs.json')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});