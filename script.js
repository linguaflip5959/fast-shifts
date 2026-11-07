/* ============================================================
   БЫСТРЫЕ СМЕНЫ — логика приложения
   ============================================================ */

// --- Регистрация Service Worker для PWA ---
// Относительный путь: работает и на GitHub Pages (/fast-shifts/), и на локальном сервере
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js')
    .catch(err => console.log('SW registration failed:', err));
}

// --- Отключение серой вспышки при тапе (Android) ---
// Свойство нестандартное: задаём только в браузерах с реальной поддержкой,
// чтобы Firefox не сыпал в консоль «Некорректное имя свойства» из CSS-файла.
// -webkit-tap-highlight-color наследуется, поэтому достаточно задать его на <html>.
if (window.CSS && CSS.supports('-webkit-tap-highlight-color', 'transparent')) {
  document.documentElement.style.setProperty('-webkit-tap-highlight-color', 'transparent');
}

// --- Тема (Dark / Light) ---
const THEME_KEY = 'fs-theme';
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  const meta = document.getElementById('meta-theme');
  if (meta) meta.content = (theme === 'light') ? '#F7F5F0' : '#0D182A';
  try { localStorage.setItem(THEME_KEY, theme); } catch(e){}
}
document.getElementById('theme-toggle').addEventListener('click', function(){
  const cur = document.documentElement.dataset.theme || 'light';
  const next = (cur === 'light') ? 'dark' : 'light';
  applyTheme(next);
});
// Синхронизируем тему между открытыми вкладками
window.addEventListener('storage', function(e){
  if (e.key === THEME_KEY && e.newValue) applyTheme(e.newValue);
});

// --- SVG-иконки ---
const ICON = {
  pin:    '<svg viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  clock:  '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7V7z"/></svg>',
  check:  '<svg viewBox="0 0 24 24"><path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm-2 16-4-4 1.4-1.4L10 14.2l6.6-6.6L18 9l-8 8z"/></svg>',
  arrow:  '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M17 7H8m9 0v9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>'
};

// --- Данные ---
let jobsData = [];
let cities = ["Москва","Санкт-Петербург","Казань","Екатеринбург","Новосибирск","Нижний Новгород","Самара","Ростов-на-Дону","Владивосток","Армавир"];
let currentCity = "Казань";
let currentFilter = "all";
let jobsLoadFailed = false;

const GLOBAL_CITIES = ["Россия","Удаленная работа","Все города"];
const TYPE_LABELS = { courier:"Курьеры", warehouse:"Склады", loader:"Грузчики", kitchen:"Кухня", promo:"Промо", retail:"Торговля", call_center:"Колл-центр", other:"Разное" };
const TYPE_ALIASES = { courier:"курьер", warehouse:"склад", loader:"грузчик", kitchen:"кухн", promo:"промо" };

// --- Партнёрская ссылка Яндекс Дистрибуции: Яндекс Браузер ---
// Показывается в модалке вакансии строкой «Ссылки проверены в Яндекс Браузере».
// Слово «Яндекс Браузере» — партнёрская ссылка; рядом обязательна пометка «Реклама»
// и erid-токен креатива (маркировка по ФЗ «О рекламе», ст. 18.1).
const BROWSER_AD_ERID = '5jtCeReNx12oak2tUyNEwv6';
const BROWSER_AD_URL = 'https://redirect.appmetrica.yandex.com/serve/606560040802878424?partner_id=831050&appmetrica_js_redirect=0&clid=15546215&banerid=1315546216&full=0&erid=' + BROWSER_AD_ERID;

// --- Утилиты ---
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function plural(n, forms){
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}
function jobMatchesFilter(job, filter){
  if (filter === 'all') return true;
  const t = String(job.type || "").toLowerCase().trim();
  if (t === filter) return true;
  const alias = TYPE_ALIASES[filter] || filter;
  return t.includes(alias) || String(job.title || "").toLowerCase().includes(alias);
}
let toastTimer = null;
function showToast(msg){
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// --- Загрузка jobs.json ---
async function loadJobs(){
  try{
    const response = await fetch("jobs.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    if (data && Array.isArray(data.jobs) && data.jobs.length > 0){
      jobsData = data.jobs;
      console.log("✅ Загружено вакансий из jobs.json:", jobsData.length);
    } else {
      throw new Error("jobs.json пуст");
    }
  } catch (error){
    console.log("⚠️ Не удалось загрузить jobs.json:", error.message);
    jobsLoadFailed = true;
    return false;
  }

  // Добавляем города из вакансий к базовому списку (кроме служебных "Россия" и т.п.)
  const citySet = new Set(cities);
  jobsData.forEach(job => {
    if (job.city && !GLOBAL_CITIES.includes(job.city)) citySet.add(job.city);
  });
  cities = Array.from(citySet).sort((a,b) => a.localeCompare(b, 'ru'));
  jobsLoadFailed = false;
  return true;
}

// Повторная загрузка (кнопка на экране ошибки)
async function retryLoadJobs(){
  showToast('Загружаем вакансии…');
  jobsLoadFailed = false;
  await loadJobs();
  renderJobs();
}

// --- Инициализация ---
async function init(){
  await loadJobs();
  bindStaticEvents();

  const savedCity = localStorage.getItem('selectedCity');
  if (savedCity){
    currentCity = savedCity;
    if (!cities.includes(savedCity)) cities.push(savedCity);
    updateUI();
  } else {
    detectCityByIP();
  }
}
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function updateUI(){
  document.getElementById("current-city").textContent = currentCity;
  document.getElementById("city-confirm").classList.remove("visible");
  renderJobs();
}

// --- Геолокация по IP ---
function detectCityByIP(){
  const confirmBlock = document.getElementById("city-confirm");
  const confirmText = document.querySelector('.city-confirm-text');
  confirmBlock.classList.add("visible");
  confirmText.innerHTML = "Определяем ваш город…";

  fetch('https://get.geojs.io/v1/ip/geo.json')
    .then(r => r.json())
    .then(data => {
      let detectedCity = data.city || data.region || "Москва";
      if (!cities.includes(detectedCity)) cities.push(detectedCity);
      currentCity = detectedCity;
      document.getElementById('current-city').textContent = currentCity;
      confirmText.innerHTML = `Мы определили, что вы из <strong>${escapeHtml(currentCity)}</strong>. Всё верно?`;
      renderJobs();
    })
    .catch(() => {
      console.log("Не удалось определить IP, по умолчанию Москва");
      currentCity = "Москва";
      document.getElementById('current-city').textContent = currentCity;
      confirmText.innerHTML = `Показываем вакансии для <strong>Москвы</strong>. Ваш город другой?`;
      renderJobs();
    });
}

// --- Отрисовка вакансий ---
function renderJobs(){
  const jobsList = document.getElementById('jobs-list');
  const jobsCount = document.getElementById('jobs-count');

  // Ошибка загрузки: показываем экран с повтором вместо пустого списка
  if (jobsData.length === 0 && jobsLoadFailed){
    jobsCount.textContent = '—';
    jobsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${ICON.search}</div>
        <div class="empty-title">Не удалось загрузить вакансии</div>
        <div class="empty-text">Проверьте подключение к интернету и попробуйте ещё раз.</div>
        <button class="btn-partner" onclick="retryLoadJobs()">Попробовать снова</button>
      </div>`;
    return;
  }

  const filteredJobs = jobsData.filter(job => {
    const isGlobal = GLOBAL_CITIES.includes(job.city);
    return (isGlobal || job.city === currentCity) && jobMatchesFilter(job, currentFilter);
  });

  jobsCount.textContent = `${filteredJobs.length} ${plural(filteredJobs.length, ['предложение','предложения','предложений'])}`;

  if (filteredJobs.length === 0){
    jobsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${ICON.search}</div>
        <div class="empty-title">Вакансий не найдено</div>
        <div class="empty-text">В выбранной категории или городе пока нет предложений. Попробуйте сбросить фильтры или выбрать другой город.</div>
        <button class="btn-partner" onclick="resetFilters()">Сбросить фильтры</button>
        <button class="btn-partner" onclick="openCityModal()">Другой город</button>
      </div>`;
    return;
  }

  jobsList.innerHTML = filteredJobs.map((job, idx) => {
    const chipLabel = TYPE_LABELS[String(job.type).toLowerCase()] || 'Вакансия';
    return `
    <article class="job-card" data-id="${escapeHtml(job.id)}" style="animation-delay:${Math.min(idx * 55, 400)}ms" tabindex="0" role="button" aria-label="Открыть вакансию ${escapeHtml(job.title)}">
      <div class="job-top">
        <h2 class="job-title">${escapeHtml(job.title)}</h2>
        <span class="job-chip">${chipLabel}</span>
      </div>
      <div class="job-pay">${escapeHtml(job.pay)}</div>
      <div class="job-details">
        <span class="job-tag">${ICON.pin} ${escapeHtml(job.city)}</span>
        <span class="job-tag">${ICON.clock} ${escapeHtml(job.schedule)}</span>
        <span class="job-tag">${ICON.check} ${escapeHtml(job.experience)}</span>
      </div>
      <div class="job-footer">
        <span class="job-date">Обновлено: ${escapeHtml(job.date)}</span>
        <button class="btn-apply" data-id="${escapeHtml(job.id)}">Подробнее ${ICON.arrow}</button>
      </div>
    </article>`;
  }).join('');
}

// --- Делегирование кликов по карточкам ---
document.getElementById('jobs-list').addEventListener('click', function(e){
  const card = e.target.closest('.job-card');
  if (card) openJobModal(card.dataset.id);
});
document.getElementById('jobs-list').addEventListener('keydown', function(e){
  if (e.key === 'Enter'){
    const card = e.target.closest('.job-card');
    if (card) openJobModal(card.dataset.id);
  }
});

// --- Отклик с метками w_sub1/w_sub2 ---
function applyJob(url, city, cta){
  // Заглушка ссылки оффера (TODO_…): карточка ещё без партнёрской ссылки —
  // честный тост вместо битого перехода. Убирается вместе с заменой url в jobs.json.
  if (!url || url.startsWith('TODO')){
    showToast('Ссылка на отклик скоро появится');
    return;
  }
  let finalUrl = url;
  const params = `w_sub1=pwa_app&w_sub2=${encodeURIComponent(city)}`;
  finalUrl += finalUrl.includes('?') ? `&${params}` : `?${params}`;
  console.log('Переход по ссылке с метками:', finalUrl);
  showToast(cta ? 'Открываем…' : 'Переходим к форме отклика…');
  // Открываем сразу, в момент клика — иначе блокировщик всплывающих окон может порезать переход
  window.open(finalUrl, '_blank');
}

// --- Плашка города ---
function confirmCity(){
  document.getElementById("city-confirm").classList.remove("visible");
  localStorage.setItem("selectedCity", currentCity);
  showToast(`Город сохранён: ${currentCity}`);
}

// --- Модалка города ---
function openCityModal(){
  document.getElementById("city-confirm").classList.remove("visible");
  document.getElementById('city-modal').classList.add('active');
  document.getElementById('city-search').value = '';
  renderCities(); // полный список, чтобы сбросить результаты прошлого поиска
  document.body.style.overflow = 'hidden';
}
function closeCityModal(){
  document.getElementById('city-modal').classList.remove('active');
  document.body.style.overflow = '';
}
function renderCities(){
  const cityList = document.getElementById('city-list');
  cityList.innerHTML = cities.map(city => `
    <div class="city-item ${city === currentCity ? 'current' : ''}" data-city="${escapeHtml(city)}" role="button" tabindex="0">
      ${ICON.pin} ${escapeHtml(city)}
    </div>`).join('');
}
function selectCity(city){
  currentCity = city;
  document.getElementById("current-city").textContent = city;
  closeCityModal();
  document.getElementById("city-search").value = "";
  renderJobs();
  localStorage.setItem("selectedCity", city);
  showToast(`Город: ${city}`);
}

document.getElementById('city-list').addEventListener('click', function(e){
  const item = e.target.closest('.city-item');
  if (item) selectCity(item.dataset.city);
});
document.getElementById('city-list').addEventListener('keydown', function(e){
  if (e.key === 'Enter'){
    const item = e.target.closest('.city-item');
    if (item) selectCity(item.dataset.city);
  }
});

document.getElementById('city-search').addEventListener('input', function(e){
  const searchTerm = e.target.value.trim();
  const searchLower = searchTerm.toLowerCase();
  const cityList = document.getElementById('city-list');

  const filteredCities = cities.filter(city => city.toLowerCase().includes(searchLower));
  let html = filteredCities.map(city => `
    <div class="city-item ${city === currentCity ? 'current' : ''}" data-city="${escapeHtml(city)}" role="button" tabindex="0">
      ${ICON.pin} ${escapeHtml(city)}
    </div>`).join('');

  // Ввели 3+ символа, а такого города нет — даём выбрать вручную
  if (searchTerm.length >= 3){
    const exactMatch = cities.some(c => c.toLowerCase() === searchLower);
    if (!exactMatch){
      html += `
        <div class="city-item city-item-add" data-city="${escapeHtml(searchTerm)}" role="button" tabindex="0">
          ${ICON.pin} Выбрать: ${escapeHtml(searchTerm)}
        </div>`;
    }
  }
  cityList.innerHTML = html || `<div class="empty-text" style="padding:18px 4px;margin:0;">Ничего не найдено — введите название города полностью.</div>`;
});

// --- Модалка вакансии ---
function openJobModal(id){
  const job = jobsData.find(j => String(j.id) === String(id));
  if (!job) return;
  const description = job.description || "Описание вакансии пока не добавлено, но условия отличные. Нажмите кнопку ниже, чтобы перейти к официальной заявке.";
  const chipLabel = TYPE_LABELS[String(job.type).toLowerCase()] || 'Вакансия';

  document.getElementById('job-modal-content').innerHTML = `
    <button class="btn-close-modal" id="job-modal-close" aria-label="Закрыть">
      <svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z"/></svg>
    </button>
    <div class="job-modal-source">${chipLabel}</div>
    <div class="job-modal-title">${escapeHtml(job.title)}</div>
    <div class="job-modal-pay">${escapeHtml(job.pay)}</div>
    <div class="job-modal-tags">
      <span class="job-tag">${ICON.pin} ${escapeHtml(job.city)}</span>
      <span class="job-tag">${ICON.clock} ${escapeHtml(job.schedule)}</span>
      <span class="job-tag">${ICON.check} ${escapeHtml(job.experience)}</span>
      <span class="job-tag">${ICON.clock} Обновлено: ${escapeHtml(job.date)}</span>
    </div>
    <div class="job-modal-divider"></div>
    <div class="job-modal-description">${escapeHtml(description)}</div>
    <div class="ad-note">Ссылки проверены в <a href="${BROWSER_AD_URL.replace(/&/g, '&amp;')}" target="_blank" rel="noopener nofollow">Яндекс Браузере</a><span class="ad-mark">Реклама</span><span class="ad-erid">erid: ${BROWSER_AD_ERID}</span></div>
    <button class="btn-modal-apply" id="btn-job-apply">${escapeHtml(job.cta || 'Откликнуться')} ${ICON.arrow}</button>`;

  document.getElementById('job-modal-close').addEventListener('click', closeJobModal);
  // w_sub2 = фактический город пользователя (для глобальных карточек «Россия»
  // раньше уходило слово «Россия» и гео в статистике терялось)
  // job.cta — свой текст кнопки для промо-карточек (напр. «Установить»)
  document.getElementById('btn-job-apply').addEventListener('click', () => applyJob(job.url, currentCity, job.cta));
  document.getElementById('job-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeJobModal(){
  document.getElementById('job-modal').classList.remove('active');
  document.body.style.overflow = '';
}

// --- Сброс фильтров ---
function resetFilters(){
  currentFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
  renderJobs();
}

// --- Статические обработчики (вешаем один раз) ---
function bindStaticEvents(){
  document.getElementById('city-open-btn').addEventListener('click', openCityModal);
  document.getElementById('btn-city-yes').addEventListener('click', confirmCity);
  document.getElementById('btn-city-no').addEventListener('click', openCityModal);
  document.getElementById('city-modal-close').addEventListener('click', closeCityModal);

  document.getElementById('city-modal').addEventListener('click', function(e){
    if (e.target === this) closeCityModal();
  });
  document.getElementById('job-modal').addEventListener('click', function(e){
    if (e.target === this) closeJobModal();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ closeCityModal(); closeJobModal(); }
  });

  // Фильтры
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function(){
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      renderJobs();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}
