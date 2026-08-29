import requests
from bs4 import BeautifulSoup
import json
import datetime

WORKLE_URL = "https://workle.ru/vacancies/" # Замени на нужный URL раздела

def parse_workle():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    response = requests.get(WORKLE_URL, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    jobs = []
    
    # ПРИМЕР: тебе нужно найти карточки вакансий (замени классы на реальные)
    vacancies = soup.find_all('div', class_='vacancy-card-class') 
    
    for v in vacancies:
        title = v.find('a', class_='title-class').text.strip()
        link = v.find('a', class_='title-class')['href']
        pay = v.find('span', class_='pay-class').text.strip()
        
        # Добавляем партнерский id в ссылку, если нужно
        if "?ref=" not in link:
            link += "?ref=твой_партнерский_id"
            
        jobs.append({
            "id": len(jobs) + 1,
            "title": title,
            "source": "Workle",
            "pay": pay,
            "city": "Казань", # Workle может отдавать город, если нет - ставим заглушку
            "type": "warehouse", # Логика определения типа
            "schedule": "Сменный",
            "experience": "Без опыта",
            "date": datetime.datetime.now().strftime("%d.%m.%Y"),
            "url": link
        })
        
    # Добавляем статичные вакансии Яндекса (чтобы лента не была пустой)
    yandex_job = {
        "id": 999,
        "title": "Курьер Яндекс Еда",
        "source": "Яндекс Еда",
        "pay": "от 3 500 ₽/день",
        "city": "Казань",
        "type": "courier",
        "schedule": "Свободный график",
        "experience": "Без опыта",
        "date": datetime.datetime.now().strftime("%d.%m.%Y"),
        "url": "https://eda.yandex.ru/courier?ref=твой_яндекс_id"
    }
    jobs.append(yandex_job)
    
    return jobs

def save_to_json(jobs):
    with open('jobs.json', 'w', encoding='utf-8') as f:
        json.dump({"jobs": jobs}, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    print("Начинаем парсинг Workle...")
    jobs_data = parse_workle()
    save_to_json(jobs_data)
    print(f"Успешно! Сохранено {len(jobs_data)} вакансий в jobs.json.")