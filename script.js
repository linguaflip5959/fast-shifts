// Регистрация Service Worker для PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .catch((err) => console.log("SW registration failed: ", err));
}

// Базовые данные (пустой массив)
let jobsData = [];
// Города (будут заполнены из jobs.json)
let cities = ["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск", "Нижний Новгород", "Самара", "Ростов-на-Дону", "Владивосток", "Армавир"];

let currentCity = "Казань";
let currentFilter = "all";

// Загрузка jobs.json
async function loadJobs() {
  try {
    const response = await fetch("jobs.json");
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();

    if (data && data.jobs && data.jobs.length > 0) {
      jobsData = data.jobs;
      console.log("✅ Загружено вакансий из jobs.json:", jobsData.length);

       // АВТОМАТИЧЕСКИ ДОБАВЛЯЕМ ГОРОДА ИЗ JOBS.JSON К БАЗОВЫМ
            if (jobsData.length > 0) {
                const citySet = new Set(cities); // Сохраняем уже существующие города
                jobsData.forEach((job) => {
                    // Добавляем только реальные города, пропуская "Россия" и т.д.
                    if (job.city && !["Россия", "Удаленная работа", "Все города"].includes(job.city)) {
                        citySet.add(job.city);
                    }
                });
                cities = Array.from(citySet).sort();
                console.log("✅ Доступные города:", cities);
            }
    } else {
      console.log("jobs.json пуст или неверный формат");
    }
  } catch (error) {
    console.log("❌ Ошибка загрузки jobs.json:", error);
  }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function () {
    await loadJobs(); // Сначала грузим вакансии и города

    const savedCity = localStorage.getItem('selectedCity');
    
    if (savedCity && cities.includes(savedCity)) {
        // Если город уже сохранен ранее, используем его
        currentCity = savedCity;
        updateUI();
    } else {
        // Если города нет, пытаемся определить по IP
        detectCityByIP();
    }
});

// Функция обновления интерфейса после выбора города
function updateUI() {
    document.getElementById("current-city").textContent = currentCity;
    document.getElementById("city-confirm").style.display = "none";
    
    // Обновляем текст в плашке подтверждения
    const confirmText = document.querySelector('.city-confirm-text strong');
    if (confirmText) confirmText.textContent = currentCity;
    
    renderCities();
    renderJobs();
    setupFilters();
}

// Определение города по IP (через бесплатный сервис)
function detectCityByIP() {
    // Показываем плашку с геолокацией
    document.getElementById("city-confirm").style.display = "flex";
    const confirmText = document.querySelector('.city-confirm-text');
    if (confirmText) confirmText.innerHTML = "Определяем ваш город...";

    fetch('https://get.geojs.io/v1/ip/geo.json')
        .then(response => response.json())
        .then(data => {
            let detectedCity = data.city || data.region || "Москва";
            
            // Если города нет в нашей базе, проверяем, есть ли он в вакансиях
            // Если нет, оставляем как есть, юзер сможет выбрать руками
            if (!cities.includes(detectedCity)) {
                cities.push(detectedCity);
            }
            
            currentCity = detectedCity;
            document.getElementById('current-city').textContent = currentCity;
            
            // Обновляем текст в плашке
            if (confirmText) confirmText.innerHTML = `Мы определили, что вы из <strong>${currentCity}</strong>. Всё верно?`;
            
            renderCities();
            renderJobs();
            setupFilters();
        })
        .catch(error => {
            console.log("Не удалось определить IP, по умолчанию Москва");
            currentCity = "Москва"; // Фолбэк, если интернет плохой или сервис лежит
            updateUI();
        });
}

// Отрисовка вакансий
function renderJobs() {
    const jobsList = document.getElementById('jobs-list');
    const jobsCount = document.getElementById('jobs-count');
    
    const filteredJobs = jobsData.filter(job => {
        // Если вакансия глобальная (Россия, Удаленка, Все города) — показываем её везде
        const isGlobal = job.city === "Россия" || job.city === "Удаленная работа" || job.city === "Все города";
        const cityMatch = isGlobal || job.city === currentCity;
        const typeMatch = currentFilter === 'all' || job.type === currentFilter;
        return cityMatch && typeMatch;
    });

    jobsCount.textContent = `${filteredJobs.length} предложений`;

    if (filteredJobs.length === 0) {
        jobsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-title">В городе ${currentCity} пока нет вакансий</div>
                <div class="empty-state-text">Но вы можете зарегистрироваться напрямую в сервисах:</div>
                <button class="btn-partner" onclick="window.open('https://ya.ru/eda', '_blank')">Яндекс Еда</button>
                <button class="btn-partner" onclick="window.open('https://samokat.ru', '_blank')">Самокат</button>
                <button class="btn-partner" onclick="window.open('https://workle.ru', '_blank')">Workle</button>
            </div>
        `;
        return;
    }

    jobsList.innerHTML = filteredJobs.map(job => `
        <div class="job-card" onclick="openJobModal(${job.id})" style="cursor: pointer;">
            <div class="job-header">
                <div>
                    <div class="job-title">${job.title}</div>
                    <div class="job-source">🔗 ${job.source}</div>
                </div>
            </div>
            <div class="job-pay">${job.pay}</div>
            <div class="job-details">
                <div class="job-tag">📍 ${job.city}</div>
                <div class="job-tag">⏰ ${job.schedule}</div>
                <div class="job-tag">✅ ${job.experience}</div>
            </div>
            <div class="job-footer">
                <div class="job-date">Обновлено: ${job.date}</div>
                <button class="btn-apply" onclick="event.stopPropagation(); openJobModal(${job.id})">
                    Подробнее
                </button>
            </div>
        </div>
    `).join('');
}

function applyJob(url, city) {
    let finalUrl = url;
    
    if (finalUrl.includes('?')) {
        finalUrl += `&w_sub1=pwa_app&w_sub2=${encodeURIComponent(city)}`;
    } else {
        finalUrl += `?w_sub1=pwa_app&w_sub2=${encodeURIComponent(city)}`;
    }
    
    console.log('Переход по ссылке с метками:', finalUrl);
    window.open(finalUrl, '_blank');
}

function confirmCity() {
  document.getElementById("city-confirm").style.display = "none";
  localStorage.setItem("selectedCity", currentCity);
}

function openCityModal() {
    document.getElementById('city-modal').classList.add('active');
    document.getElementById('city-confirm').style.display = 'none';
    
    // Очищаем поле поиска
    document.getElementById('city-search').value = '';
    
    // Заново отрисовываем полный список городов, чтобы сбросить старый поиск
    renderCities(); 
}

document.getElementById("city-modal").addEventListener("click", function (e) {
  if (e.target === this) {
    this.classList.remove("active");
  }
});

function renderCities() {
    const cityList = document.getElementById('city-list');
    cityList.innerHTML = cities.map(city => `
        <div class="city-item" onclick="selectCity('${city}')">
            ${city}
        </div>
    `).join('');
}

function selectCity(city) {
  currentCity = city;
  document.getElementById("current-city").textContent = city;
  document.getElementById("city-modal").classList.remove("active");
  document.getElementById("city-search").value = "";
  renderJobs();
  localStorage.setItem("selectedCity", city);
}

document.getElementById('city-search').addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim();
    const searchLower = searchTerm.toLowerCase();
    const cityList = document.getElementById('city-list');
    
    // Ищем совпадения по базе
    const filteredCities = cities.filter(city => city.toLowerCase().includes(searchLower));
    
    let html = filteredCities.map(city => `
        <div class="city-item" onclick="selectCity('${city}')">
            ${city}
        </div>
    `).join('');
    
    // Если ввели 3 и более символов, и такого города нет в базе — даем выбрать вручную
    if (searchTerm.length >= 3) {
        const exactMatch = cities.some(c => c.toLowerCase() === searchLower);
        if (!exactMatch) {
            html += `
                <div class="city-item" style="background: rgba(16, 185, 129, 0.1); color: #047857; font-weight: 800; border: 1px solid #6ee7b7;" onclick="selectCity('${searchTerm}')">
                    Выбрать: ${searchTerm}
                </div>
            `;
        }
    }
    
    cityList.innerHTML = html;
});

function openJobModal(id) {
    const job = jobsData.find(j => j.id === id);
    if (!job) return;
    
    const modalContent = document.getElementById('job-modal-content');
    // Если описания нет, выводим запасной текст
    const description = job.description || "Описание вакансии пока не добавлено, но условия отличные! Нажмите кнопку ниже, чтобы перейти к официальной заявке.";
    
    modalContent.innerHTML = `
        <button class="btn-close-modal" onclick="closeJobModal()">✕</button>
        <div class="job-modal-header">
            <div class="job-modal-title">${job.title}</div>
            <div class="job-source">🔗 ${job.source}</div>
        </div>
        <div class="job-modal-pay">${job.pay}</div>
        <div class="job-modal-tags">
            <div class="job-tag">📍 ${job.city}</div>
            <div class="job-tag">⏰ ${job.schedule}</div>
            <div class="job-tag">✅ ${job.experience}</div>
        </div>
        <div class="job-modal-description">${description}</div>
        <button class="btn-modal-apply" onclick="applyJob('${job.url}', '${job.city}')">
            Откликнуться
        </button>
    `;
    
    document.getElementById('job-modal').classList.add('active');
}

function closeJobModal() {
    document.getElementById('job-modal').classList.remove('active');
}

// Закрытие при клике вне окна
document.getElementById('job-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.remove('active');
    }
});

function setupFilters() {
  const filterButtons = document.querySelectorAll(".filter-btn");
  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");
      currentFilter = this.dataset.filter;
      renderJobs();
    });
  });
}
