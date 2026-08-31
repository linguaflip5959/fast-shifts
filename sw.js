const CACHE_NAME = 'fast-shifts-v2';
const urlsToCache = ['./', './index.html', './style.css', './script.js', './jobs.json', './icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Кэшируем файлы по одному, чтобы один битый не сломил всё приложение
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting(); // Активируем новый SW сразу
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // jobs.json всегда берем из сети, чтобы ручные обновления сразу работали
  if (requestUrl.pathname.endsWith('/jobs.json')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Остальное берем из кэша, если есть, иначе из сети
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});