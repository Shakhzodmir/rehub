import type {
  Appointment,
  Message,
  Patient,
  Referral,
  TreatmentPlan,
  User,
  WorkoutSession,
} from "./types";

export const USERS: Record<string, User> = {
  patient: {
    id: "u-patient",
    name: "Анна Соколова",
    email: "anna@demo.health",
    role: "patient",
    title: "Реабилитация колена",
  },
  therapist: {
    id: "u-therapist",
    name: "Игорь Лебедев",
    email: "igor@demo.health",
    role: "therapist",
    title: "Физический терапевт",
  },
  doctor: {
    id: "u-doctor",
    name: "Мария Орлова",
    email: "maria@demo.health",
    role: "doctor",
    title: "Врач-ортопед",
  },
  admin: {
    id: "u-admin",
    name: "Дмитрий Власов",
    email: "dmitry@demo.health",
    role: "admin",
    title: "Администратор платформы",
  },
};

export const PATIENTS: Patient[] = [
  {
    id: "p-1",
    name: "Анна Соколова",
    email: "anna@demo.health",
    age: 34,
    condition: "Реабилитация после артроскопии колена",
    therapistId: "u-therapist",
    adherence: 86,
    status: "active",
    recoveryProgress: 64,
    lastActive: new Date(Date.now() - 3 * 3600_000).toISOString(),
    startedAt: "2026-04-12",
  },
  {
    id: "p-2",
    name: "Олег Петров",
    email: "oleg@demo.health",
    age: 52,
    condition: "Боль в нижней части спины (L4–L5)",
    therapistId: "u-therapist",
    adherence: 41,
    status: "at-risk",
    recoveryProgress: 28,
    lastActive: new Date(Date.now() - 5 * 86400_000).toISOString(),
    startedAt: "2026-05-02",
  },
  {
    id: "p-3",
    name: "Светлана Кузьмина",
    email: "sveta@demo.health",
    age: 29,
    condition: "Восстановление плеча после вывиха",
    therapistId: "u-therapist",
    adherence: 92,
    status: "active",
    recoveryProgress: 78,
    lastActive: new Date(Date.now() - 26 * 3600_000).toISOString(),
    startedAt: "2026-03-20",
  },
  {
    id: "p-4",
    name: "Виктор Зайцев",
    email: "viktor@demo.health",
    age: 61,
    condition: "Эндопротезирование тазобедренного сустава",
    therapistId: "u-therapist",
    adherence: 73,
    status: "active",
    recoveryProgress: 51,
    lastActive: new Date(Date.now() - 12 * 3600_000).toISOString(),
    startedAt: "2026-04-28",
  },
  {
    id: "p-5",
    name: "Елена Морозова",
    email: "elena@demo.health",
    age: 45,
    condition: "Реабилитация голеностопа",
    therapistId: "u-therapist",
    adherence: 100,
    status: "discharged",
    recoveryProgress: 100,
    lastActive: new Date(Date.now() - 9 * 86400_000).toISOString(),
    startedAt: "2026-02-10",
  },
];

export const ACTIVE_PLAN: TreatmentPlan = {
  id: "plan-1",
  patientId: "p-1",
  therapistId: "u-therapist",
  title: "Программа восстановления колена · Фаза 2",
  status: "active",
  createdAt: "2026-05-15",
  diagnosis: "Состояние после артроскопии коленного сустава",
  icd: "M23.2",
  notes: "Фокус на восстановление ROM и силы квадрицепса. Контроль боли ≤ 3/10.",
  exercises: [
    { key: "squats", targetReps: 12, targetSets: 3 },
    { key: "glute-bridge", targetReps: 15, targetSets: 3, holdSeconds: 3 },
    { key: "lunges", targetReps: 10, targetSets: 2 },
    { key: "heel-toe", targetReps: 20, targetSets: 1 },
  ],
};

export const PLANS: TreatmentPlan[] = [
  ACTIVE_PLAN,
  {
    id: "plan-2",
    patientId: "p-3",
    therapistId: "u-therapist",
    title: "Стабилизация плеча · Фаза 3",
    status: "active",
    createdAt: "2026-05-01",
    diagnosis: "Передний вывих плеча",
    icd: "S43.0",
    exercises: [
      { key: "pushups", targetReps: 8, targetSets: 3 },
      { key: "jumping-jacks", targetReps: 30, targetSets: 2 },
    ],
  },
  {
    id: "plan-3",
    patientId: "p-2",
    therapistId: "u-therapist",
    title: "Программа для поясницы",
    status: "paused",
    createdAt: "2026-05-10",
    diagnosis: "Люмбаго",
    icd: "M54.5",
    exercises: [{ key: "glute-bridge", targetReps: 12, targetSets: 3, holdSeconds: 5 }],
  },
];

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

export const SESSIONS: WorkoutSession[] = [
  { id: "s-1", patientId: "p-1", date: daysAgo(0), exercise: "squats", reps: 11, targetReps: 12, durationSec: 320, formScore: 88, violations: 2 },
  { id: "s-2", patientId: "p-1", date: daysAgo(0), exercise: "glute-bridge", reps: 15, targetReps: 15, durationSec: 240, formScore: 94, violations: 0 },
  { id: "s-3", patientId: "p-1", date: daysAgo(1), exercise: "squats", reps: 12, targetReps: 12, durationSec: 300, formScore: 82, violations: 4 },
  { id: "s-4", patientId: "p-1", date: daysAgo(2), exercise: "lunges", reps: 8, targetReps: 10, durationSec: 280, formScore: 76, violations: 5 },
  { id: "s-5", patientId: "p-1", date: daysAgo(3), exercise: "squats", reps: 12, targetReps: 12, durationSec: 290, formScore: 90, violations: 1 },
  { id: "s-6", patientId: "p-1", date: daysAgo(4), exercise: "glute-bridge", reps: 14, targetReps: 15, durationSec: 250, formScore: 91, violations: 1 },
  { id: "s-7", patientId: "p-1", date: daysAgo(6), exercise: "squats", reps: 10, targetReps: 12, durationSec: 310, formScore: 79, violations: 3 },
];

/** weekly adherence trend for charts */
export const ADHERENCE_TREND = [
  { week: "Нед 1", adherence: 55, pain: 6 },
  { week: "Нед 2", adherence: 62, pain: 5 },
  { week: "Нед 3", adherence: 71, pain: 5 },
  { week: "Нед 4", adherence: 68, pain: 4 },
  { week: "Нед 5", adherence: 80, pain: 3 },
  { week: "Нед 6", adherence: 86, pain: 3 },
];

export const ROM_TREND = [
  { week: "Нед 1", rom: 78, target: 135 },
  { week: "Нед 2", rom: 92, target: 135 },
  { week: "Нед 3", rom: 104, target: 135 },
  { week: "Нед 4", rom: 112, target: 135 },
  { week: "Нед 5", rom: 121, target: 135 },
  { week: "Нед 6", rom: 128, target: 135 },
];

export const MESSAGES: Message[] = [
  { id: "m-1", threadId: "t-1", fromId: "u-therapist", fromName: "Игорь Лебедев", text: "Анна, отличный прогресс на этой неделе! Колено сгибается заметно лучше.", at: daysAgo(1), mine: false },
  { id: "m-2", threadId: "t-1", fromId: "u-patient", fromName: "Анна Соколова", text: "Спасибо! Но после выпадов есть лёгкая боль сбоку.", at: daysAgo(1), mine: true },
  { id: "m-3", threadId: "t-1", fromId: "u-therapist", fromName: "Игорь Лебедев", text: "Снизим число повторов выпадов до 8 и добавим больше мостиков. Боль не должна превышать 3/10.", at: daysAgo(0), mine: false },
];

export const REFERRALS: Referral[] = [
  { id: "r-1", patientName: "Анна Соколова", doctorName: "Мария Орлова", diagnosis: "Состояние после артроскопии колена", icd: "M23.2", status: "in-progress", date: "2026-04-10", priority: "обычный" },
  { id: "r-2", patientName: "Павел Сидоров", doctorName: "Мария Орлова", diagnosis: "Разрыв передней крестообразной связки", icd: "S83.5", status: "pending", date: "2026-06-25", priority: "срочный" },
  { id: "r-3", patientName: "Ирина Белова", doctorName: "Мария Орлова", diagnosis: "Тендинит ротаторной манжеты", icd: "M75.1", status: "accepted", date: "2026-06-18", priority: "обычный" },
  { id: "r-4", patientName: "Елена Морозова", doctorName: "Мария Орлова", diagnosis: "Растяжение голеностопа", icd: "S93.4", status: "completed", date: "2026-02-08", priority: "обычный" },
];

export const APPOINTMENTS: Appointment[] = [
  { id: "a-1", title: "Контрольная оценка", with: "Игорь Лебедев", at: new Date(Date.now() + 2 * 86400_000).toISOString(), kind: "follow-up" },
  { id: "a-2", title: "Повторное тестирование ROM", with: "Игорь Лебедев", at: new Date(Date.now() + 6 * 86400_000).toISOString(), kind: "assessment" },
];

/** platform-level analytics for admin */
export const ADMIN_METRICS = {
  mrr: 48250,
  mrrDelta: 12.4,
  activePatients: 1284,
  patientsDelta: 8.1,
  therapists: 96,
  therapistsDelta: 4,
  churn: 3.2,
  churnDelta: -0.6,
  arpu: 37.6,
};

export const REVENUE_TREND = [
  { month: "Янв", mrr: 28000, patients: 720 },
  { month: "Фев", mrr: 31500, patients: 810 },
  { month: "Мар", mrr: 35200, patients: 905 },
  { month: "Апр", mrr: 39800, patients: 1040 },
  { month: "Май", mrr: 43900, patients: 1170 },
  { month: "Июн", mrr: 48250, patients: 1284 },
];

export const EXERCISE_USAGE = [
  { name: "Приседания", value: 4120 },
  { name: "Мостик", value: 3380 },
  { name: "Выпады", value: 2510 },
  { name: "Отжимания", value: 1980 },
  { name: "Звёздочка", value: 1640 },
  { name: "Пятка-носок", value: 1290 },
];

export const AUDIT_LOGS = [
  { id: "al-1", at: new Date(Date.now() - 12 * 60000).toISOString(), actor: "Игорь Лебедев", action: "Создан план лечения", target: "Анна Соколова", severity: "info" as const },
  { id: "al-2", at: new Date(Date.now() - 90 * 60000).toISOString(), actor: "Система", action: "Обнаружен риск (пропуск 5 сессий)", target: "Олег Петров", severity: "warning" as const },
  { id: "al-3", at: new Date(Date.now() - 5 * 3600_000).toISOString(), actor: "Дмитрий Власов", action: "Одобрена лицензия терапевта", target: "Игорь Лебедев", severity: "info" as const },
  { id: "al-4", at: new Date(Date.now() - 26 * 3600_000).toISOString(), actor: "Система", action: "Неуспешный платёж", target: "Виктор Зайцев", severity: "error" as const },
  { id: "al-5", at: new Date(Date.now() - 50 * 3600_000).toISOString(), actor: "Мария Орлова", action: "Отправлено направление", target: "Павел Сидоров", severity: "info" as const },
];

export const PLATFORM_USERS = [
  { id: "u-therapist", name: "Игорь Лебедев", role: "Терапевт", email: "igor@demo.health", status: "Активен", joined: "2026-01-14" },
  { id: "u-doctor", name: "Мария Орлова", role: "Врач", email: "maria@demo.health", status: "Активен", joined: "2026-02-02" },
  { id: "u-patient", name: "Анна Соколова", role: "Пациент", email: "anna@demo.health", status: "Активен", joined: "2026-04-12" },
  { id: "u-5", name: "Олег Петров", role: "Пациент", email: "oleg@demo.health", status: "Под угрозой", joined: "2026-05-02" },
  { id: "u-6", name: "Сергей Новиков", role: "Терапевт", email: "sergey@demo.health", status: "На проверке", joined: "2026-06-20" },
];
