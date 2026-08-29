const CACHE_NAME = "fast-shifts-v2";
const urlsToCache = ["/", "/index.html", "/style.css", "/script.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // jobs.json всегда берем из сети (чтобы ручные обновления сразу работали)
  if (requestUrl.pathname.endsWith("/jobs.json")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Остальное (стили, скрипты) берем из кэша
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request)),
  );
});
