# OhMyGas

Монітор цін на пальне в Україні: мапа АЗС з фільтрами та персональні знижки за мережею й видом пального.

Статичний сайт (React + TypeScript + Leaflet) на GitHub Pages. Дані оновлює планувальник GitHub Actions
і зберігає як JSON у папці `data/` — сервер не потрібен.

## Структура

- `apps/web` — застосунок (Vite + React). Знижки зберігаються в `localStorage` браузера.
- `apps/data` — скрипт оновлення даних: ціни з [minfin](https://index.minfin.com.ua/ua/markets/fuel/tm/)
  (середні по мережах), АЗС з OpenStreetMap (Overpass).
- `packages/shared` — спільні типи, мережі, розрахунок ціни зі знижкою.
- `data/` — `prices.json`, `history.json` (щоденна історія), `stations.json`. Комітяться ботом.
- `.github/workflows/deploy.yml` — оновлення даних + збірка + публікація.

## Локально (Node 20+)

```bash
npm install
npm run update-data   # оновити data/*.json (потрібен інтернет; станції ~1–5 хв)
npm run dev           # http://localhost:5173
npm test && npm run typecheck
```

## Публікація на GitHub Pages

1. Створіть репозиторій на GitHub і запуште код у гілку `main`.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Actions → «Update data and deploy» → Run workflow (або просто push у `main`).

Сайт буде за адресою `https://<user>.github.io/<repo>/`. Далі воркфлоу сам запускається кожні 6 годин.

## Обмеження

- Ціни — середні по мережі (minfin), не по конкретній АЗС. minfin оновлює їх раз на добу.
- Якщо верстка minfin зміниться, парсер зупиниться з помилкою, сайт залишиться зі старими цінами,
  а запуск воркфлоу стане червоним.
- Для публічних репозиторіїв планові запуски GitHub вимикає після 60 днів без активності —
  у такому разі увімкніть воркфлоу вручну на вкладці Actions.
