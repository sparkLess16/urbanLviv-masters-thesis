# 📘 UrbanLviv

> Вебзастосунок для подання та обробки міських звернень мешканців Львова.

Звернення можна подавати з картою та адресою, шукати схожі звернення, підтримувати вже подані замість дублікатів, бачити групи звернень (кластери) з відповідальною службою. Схожість рахується за змістом тексту (embeddings) і відстанню.

## Технології
- **Frontend:** React 19, React Router 7, Leaflet (карта OpenStreetMap).
- **Backend:** Node.js, Express 5, Mongoose.
- **База даних:** MongoDB Atlas із Vector Search (єдине сховище, у тому числі для векторів).
- **Зовнішні сервіси:** Gemini API (embeddings, аналіз звернень, суддя кластеризації), Nominatim (геокодування), Google Identity Services (вхід), Cloudinary (фото), Brevo SMTP (листи).

## Вимоги
- Node.js 20 або новіше, npm.
- Кластер MongoDB Atlas (достатньо безкоштовного M0). У Network Access додайте вашу IP-адресу.
- Ключ Gemini API (Google AI Studio).
- За потреби: OAuth Client ID (Google), акаунти Cloudinary і Brevo.

## Налаштування змінних середовища
Секрети зберігаються лише у змінних середовища, у репозиторій не потрапляють (`.env` у `.gitignore`).

| Файл | Призначення |
|---|---|
| `backend/.env` | Backend: `PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BREVO_SMTP_HOST`, `BREVO_SMTP_PORT`, `BREVO_SMTP_USER`, `BREVO_SMTP_PASS`, `EMAIL_FROM` |
| `.env.local` (корінь) | Frontend: `REACT_APP_API_URL`, `REACT_APP_GOOGLE_CLIENT_ID` |

Необов'язкові змінні backend: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `CLUSTER_JUDGE` (`off` вимикає суддю), `CLUSTER_JUDGE_MODEL`, `EXPERIMENT_DB_NAME`, `LOAD_DB_NAME`.

## Встановлення і запуск
```bash
# backend
cd backend
npm install
npm run dev          # http://localhost:5000

# frontend (в іншому терміналі, з кореня проєкту)
npm install
npm start            # http://localhost:3000
```

## Одноразова підготовка бази (Atlas)
Виконуються з папки `backend`, команди безпечно повторювати.

```bash
npm run index:vector     # індекс Atlas Vector Search reports_embedding_index (768 вимірів, косинусна схожість)
npm run index:comments   # унікальний індекс «одна підтримка від користувача на звернення»
```
Просторовий індекс `2dsphere` на полі `geo` створюється автоматично під час першого запуску.

Якщо в базі вже є звернення без координат чи векторів:
```bash
npm run geocode:legacy         # координати для старих звернень
npm run backfill:embeddings    # вектори (один запит до Gemini на звернення)
npm run backfill:clusters      # кластери
npm run backfill:services      # відповідальні служби кластерів
```
Межі районів лежать у `backend/data/lviv_districts.geojson` (з OpenStreetMap, © OpenStreetMap contributors); оновити їх можна командою `npm run fetch:districts`.

## Тести та перевірка коду
```bash
cd backend
npm test           # 144 тести (вбудований test runner Node.js)
npm run lint
npm run format:check
```

## Дослідження (експерименти)
Дослідницькі скрипти працюють в окремих базах із «experiment» у назві й не зачіпають робочу базу. Дані оцінювального набору лежать у `backend/data/eval/`.

```bash
npm run seed:dataset                  # 349 розмічених звернень -> urbanlviv_experiments
npm run eval:similarity -- --sweep    # Precision@5, стратегії та α
npm run eval:clustering               # метрики кластеризації
npm run compare:models                # порівняння двох моделей embeddings
npm run seed:load                     # 10 000 синтетичних звернень -> urbanlviv_experiments_load
npm run measure:latency               # час відповіді (NFR-01)
```
Після `seed:load` для навантажувальної бази потрібен векторний індекс: запустіть `index:vector` з `-- --experiment` та змінною `EXPERIMENT_DB_NAME=urbanlviv_experiments_load`. Безкоштовний Atlas M0 дозволяє не більше трьох таких індексів.

## Структура
```
src/                 frontend (React)
backend/src/         API: routes, controllers, models, services, utils
backend/scripts/     одноразові та дослідницькі скрипти
backend/data/        межі районів, оцінювальний набір, результати вимірювань
backend/tests/       автоматичні тести
```
