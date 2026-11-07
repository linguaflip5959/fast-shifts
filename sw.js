/* ============================================================
   БЫСТРЫЕ СМЕНЫ — Service Worker v8
   1) В index.html добавлен код подтверждения прав на площадку
      (7ftz2lh2eczgzn64): meta-тег + скрытый элемент.
   2) Во все ссылки advt.pro добавлена метка трафика
      w_sub1=pwa_app (учёт заявок из PWA в личном кабинете).
   ============================================================ */

const CACHE_NAME = 'fast-shifts-v8';

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon192.png',
  './icon512.png'
];

// Установка: кэшируем основные файлы (allSettled — не падаем, если чего-то нет)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

// Активация: подчищаем старые версии кэша и сразу перехватываем управление
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // jobs.json — всегда свежий из сети; офлайн — отдаём последнюю копию из кэша
  if (url.pathname.endsWith('/jobs.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Шрифты с CDN — кэшируем при первой загрузке, дальше работают офлайн
  if (url.origin === 'https://cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
      )
    );
    return;
  }

  // Свои файлы — сначала кэш (мгновенный старт), потом сеть
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
  }
});
