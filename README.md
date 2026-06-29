# POSETRACK — платформа дистанционной реабилитации

Пересборка UI проекта (Lovable-исходники утеряны). Многоролевая telehealth-платформа:
пациент выполняет упражнения дома перед камерой, компьютерное зрение (**MediaPipe Pose**)
в реальном времени отслеживает технику и считает повторения; терапевт, врач и
администратор работают в своих кабинетах.

## Стек

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** + UI-примитивы в стиле shadcn/ui (Button, Card, Badge, Table, Tabs…)
- **react-router-dom** — роутинг и role-based навигация
- **@mediapipe/tasks-vision** — детекция позы (33 точки), подсчёт повторов по углам суставов
- **recharts** — графики
- **lucide-react** — иконки

> Данные пока **mock** (`src/lib/mock-data.ts`). Структура готова под подключение Supabase.

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production-сборка в dist/
npm run lint     # проверка типов (tsc --noEmit)
```

## Роли и маршруты

На экране входа (`/login`) выбирается роль — это демо-вход без пароля.

| Роль | Маршрут | Ключевые экраны |
|------|---------|-----------------|
| **Пациент** | `/patient` | Обзор, Упражнения, **Тренировка с камерой** (`/patient/session/:key`), План, Прогресс, Сообщения |
| **Терапевт** | `/therapist` | Обзор, Пациенты, Карточка пациента, Планы лечения, Сообщения |
| **Врач** | `/doctor` | Обзор, Направления (создание), Отчёты |
| **Администратор** | `/admin` | Обзор, Аналитика, Библиотека упражнений, Пользователи, Журнал аудита |

## Структура

```
src/
  components/
    ui/            UI-примитивы (button, card, badge, input, table, tabs…)
    common/        StatCard, PageHeader, ChatThread
    layout/        AppShell, Sidebar, Topbar, nav-config
  context/         AuthContext (mock-роли в localStorage)
  hooks/           usePoseTracker (MediaPipe + камера + state-machine повторов)
  lib/
    pose/angle.ts  вычисление углов суставов
    exercises.ts   каталог упражнений + параметры детекции
    mock-data.ts   демо-данные (пациенты, планы, сессии, метрики…)
    types.ts
  pages/           экраны по ролям
```

## Ядро: анализ позы

[src/hooks/usePoseTracker.ts](src/hooks/usePoseTracker.ts) загружает `PoseLandmarker`
(модель `pose_landmarker_lite`, GPU), запускает камеру через `getUserMedia`, на каждом
кадре рисует скелет на canvas и прогоняет state-machine `idle → down → up` по углу
целевого сустава (например, для приседаний — угол `бедро-колено-голеностоп`, диапазон
`100°–160°`). Повтор засчитывается на фазе разгибания; проверяется глубина для оценки
техники. Видео **не покидает браузер**.

Параметры каждого упражнения (целевой сустав, пороги углов, режим rep/balance) заданы
в [src/lib/exercises.ts](src/lib/exercises.ts).
