/* ============================================================
   БЫСТРЫЕ СМЕНЫ — Service Worker v12
   1) В index.html добавлен код подтверждения прав на площадку
      (7ftz2lh2eczgzn64): meta-тег + скрытый элемент.
   2) Промо-карточки Яндекса убраны из ленты по решению владельца:
      вместо них в каждой модалке вакансии нативная строка
      «Ссылки проверены в Яндекс Браузере» — слово «Яндекс Браузере»
      ведёт по партнёрской ссылке Яндекс Дистрибуции (клик = установка
      браузера, оплата за подтверждённую установку). Рядом пометка
      «Реклама».
   3) script.js: константа BROWSER_AD_URL; поле cta (свой текст
      кнопки в модалке) — оставлено для будущих форматов.
   4) Получен erid-токен креатива (5jtCeReNx12oak2tUyNEwv6):
      дописан параметром &erid= к BROWSER_AD_URL и показан мелким
      шрифтом в пометке «Реклама» в модалке вакансии (style.css:
      класс .ad-erid).
   5) Новый оффер «Магнит Доставка» (авто-/велокурьеры): 16 карточек
      по городам с тарифами из таблицы оффера (id 1801–1816, в ленте
      после Яндекс.Еды). Ссылка на отклик — заглушка
      TODO_MAGNIT_ADVT_LINK: будет заменена advt.pro-ссылкой оффера;
      applyJob блокирует переход по заглушке тостом.
   ============================================================ */

const CACHE_NAME = 'fast-shifts-v13';

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
