// Регистрация Service Worker для PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .catch((err) => console.log("SW registration failed: ", err));
}

// Базовые данные (пустой массив)
let jobsData = [];
// Города (будут заполнены из jobs.json)
let cities = ["Казань"];

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

      // АВТОМАТИЧЕСКИ СОБИРАЕМ ГОРОДА ИЗ JOBS.JSON
      const citySet = new Set();
      jobsData.forEach((job) => citySet.add(job.city));
      cities = Array.from(citySet).sort();
      console.log("✅ Доступные города:", cities);
    } else {
      console.log("jobs.json пуст или неверный формат");
    }
  } catch (error) {
    console.log("❌ Ошибка загрузки jobs.json:", error);
  }
}

// Инициализация приложения
document.addEventListener("DOMContentLoaded", async function () {
  await loadJobs(); // Сначала грузим вакансии и города

  // Проверяем, есть ли сохранённый город
  const savedCity = localStorage.getItem("selectedCity");
  if (savedCity && cities.includes(savedCity)) {
    currentCity = savedCity;
  } else if (cities.length > 0) {
    currentCity = cities[0]; // Берём первый город из списка
  }

  document.getElementById("current-city").textContent = currentCity;
  document.getElementById("city-confirm").style.display = "none";

  renderCities();
  renderJobs();
  setupFilters();
});

// Отрисовка вакансий
function renderJobs() {
  const jobsList = document.getElementById("jobs-list");
  const jobsCount = document.getElementById("jobs-count");

  const filteredJobs = jobsData.filter((job) => {
    const cityMatch = job.city === currentCity;
    const typeMatch = currentFilter === "all" || job.type === currentFilter;
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

  jobsList.innerHTML = filteredJobs
    .map(
      (job) => `
        <div class="job-card">
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
                <button class="btn-apply" onclick="applyJob('${job.url}')">
                    Откликнуться
                </button>
            </div>
        </div>
    `,
    )
    .join("");
}

function applyJob(url, city) {
    let finalUrl = url;
    
    // Если в ссылке уже есть вопросительный знак, добавляем через &, иначе через ?
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
  document.getElementById("city-modal").classList.add("active");
  document.getElementById("city-confirm").style.display = "none";
}

document.getElementById("city-modal").addEventListener("click", function (e) {
  if (e.target === this) {
    this.classList.remove("active");
  }
});

function renderCities() {
  const cityList = document.getElementById("city-list");
  cityList.innerHTML = cities
    .map(
      (city) => `
        <div class="city-item" onclick="selectCity('${city}')">
            ${city}
        </div>
    `,
    )
    .join("");
}

function selectCity(city) {
  currentCity = city;
  document.getElementById("current-city").textContent = city;
  document.getElementById("city-modal").classList.remove("active");
  document.getElementById("city-search").value = "";
  renderJobs();
  localStorage.setItem("selectedCity", city);
}

document.getElementById("city-search").addEventListener("input", function (e) {
  const searchTerm = e.target.value.toLowerCase();
  const filteredCities = cities.filter((city) =>
    city.toLowerCase().includes(searchTerm),
  );

  const cityList = document.getElementById("city-list");
  cityList.innerHTML = filteredCities
    .map(
      (city) => `
        <div class="city-item" onclick="selectCity('${city}')">
            ${city}
        </div>
    `,
    )
    .join("");
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
