import json
import os

FILE_NAME = "jobs.json"


def load_jobs():
    if os.path.exists(FILE_NAME):
        with open(FILE_NAME, "r", encoding="utf-8") as f:
            try:
                return json.load(f).get("jobs", [])
            except json.JSONDecodeError:
                return []
    return []


def save_jobs(jobs):
    with open(FILE_NAME, "w", encoding="utf-8") as f:
        json.dump({"jobs": jobs}, f, ensure_ascii=False, indent=4)
    print(f"\n✅ Готово! Файл {FILE_NAME} обновлен. Вакансий в базе: {len(jobs)}")


def main():
    print("=== Добавление новой вакансии ===")
    print("(Нажми Enter, чтобы оставить значение по умолчанию)\n")

    jobs = load_jobs()

    title = input("Название вакансии (напр., Курьер на склад): ")
    source = input("Источник (Яндекс Еда, Workle): ")
    pay = input("Зарплата (напр., от 3000 ₽/день): ")
    city = input("Город (напр., Казань): ")

    print("\nВыбери тип (введи цифру):")
    print("1 - Курьер\n2 - Склад\n3 - Грузчик\n4 - Кухня\n5 - Промо\n6 - Другое")
    type_choice = input("Тип: ")
    types = {
        "1": "courier",
        "2": "warehouse",
        "3": "loader",
        "4": "kitchen",
        "5": "promo",
        "6": "other",
    }
    job_type = types.get(type_choice, "other")

    schedule = input("График (Свободный график, 5/2, Разовая): ")
    experience = input("Опыт (Без опыта, Опыт обязателен): ")
    url = input("Партнёрская ссылка (URL): ")

    new_id = len(jobs) + 1

    new_job = {
        "id": new_id,
        "title": title,
        "source": source,
        "pay": pay,
        "city": city,
        "type": job_type,
        "schedule": schedule if schedule else "Не указан",
        "experience": experience if experience else "Без опыта",
        "date": "Сегодня",
        "url": url,
    }

    jobs.append(new_job)
    save_jobs(jobs)


if __name__ == "__main__":
    main()
