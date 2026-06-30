import type { ExerciseDef, ExerciseKey } from "./types";

// MediaPipe Pose landmark indices used below:
// 11 L-shoulder 12 R-shoulder · 13 L-elbow 14 R-elbow · 15 L-wrist 16 R-wrist
// 23 L-hip 24 R-hip · 25 L-knee 26 R-knee · 27 L-ankle 28 R-ankle
//
// effortPhase encodes WHERE the work happens, so the quality score is measured
// against the effort extreme (not the rest position):
//   flex   → effort is the low-angle/contracted position (squat down, push-up down)
//   extend → effort is the high-angle/extended position (bridge up, jacks arms up)
export const EXERCISES: Record<ExerciseKey, ExerciseDef> = {
  squats: {
    key: "squats",
    name: "Приседания",
    emoji: "🦵",
    focus: "Ноги и ягодицы",
    description: "Нижняя часть тела, сила квадрицепсов и ягодичных мышц.",
    difficulty: "Среднее",
    mode: "rep",
    joint: [24, 26, 28], // hip-knee-ankle
    downAngle: 100,
    upAngle: 160,
    effortPhase: "flex",
    depthMargin: 8,
    targetROM: 135,
    plane: "sagittal",
    shallowCue: "Глубже — опускайтесь ниже",
    cues: [
      "Спина прямая, взгляд вперёд",
      "Колени не выходят за носки",
      "Опускайтесь до угла ~90° в колене",
    ],
  },
  pushups: {
    key: "pushups",
    name: "Отжимания",
    emoji: "💪",
    focus: "Верх корпуса",
    description: "Грудь, плечи и трицепс, стабилизация корпуса.",
    difficulty: "Высокое",
    mode: "rep",
    joint: [12, 14, 16], // shoulder-elbow-wrist
    downAngle: 95,
    upAngle: 160,
    effortPhase: "flex",
    depthMargin: 8,
    plane: "sagittal",
    shallowCue: "Ниже — сгибайте локти сильнее",
    cues: ["Корпус прямой линией", "Локти под 45°", "Опускайтесь до угла ~90° в локте"],
  },
  "jumping-jacks": {
    key: "jumping-jacks",
    name: "Прыжки «Звёздочка»",
    emoji: "⭐",
    focus: "Кардио",
    description: "Интенсивная кардиотренировка всего тела.",
    difficulty: "Среднее",
    mode: "rep",
    joint: [24, 12, 16], // hip-shoulder-wrist (arm abduction)
    downAngle: 50, // arms at sides
    upAngle: 130, // arms overhead — this is the effort
    effortPhase: "extend",
    depthMargin: 10,
    plane: "frontal", // seen head-on → use 3D angle so depth doesn't collapse it
    shallowCue: "Руки выше — до конца вверх",
    cues: ["Руки полностью вверх", "Ноги на ширину плеч в прыжке", "Держите ритм"],
  },
  lunges: {
    key: "lunges",
    name: "Выпады",
    emoji: "🚶",
    focus: "Ноги",
    description: "Укрепление ног и баланса, односторонняя нагрузка.",
    difficulty: "Среднее",
    mode: "rep",
    joint: [24, 26, 28], // hip-knee-ankle (front leg)
    downAngle: 100,
    upAngle: 160,
    effortPhase: "flex",
    depthMargin: 8,
    plane: "sagittal",
    shallowCue: "Глубже — переднее колено к 90°",
    cues: ["Переднее колено под 90°", "Корпус вертикально", "Колено не касается пола резко"],
  },
  "glute-bridge": {
    key: "glute-bridge",
    name: "Ягодичный мостик",
    emoji: "🌉",
    focus: "Низ корпуса",
    description: "Ягодичные мышцы и поясница, безопасно для коленей.",
    difficulty: "Лёгкое",
    mode: "rep",
    joint: [12, 24, 26], // shoulder-hip-knee
    downAngle: 130, // hips resting
    upAngle: 160, // hips lifted to a line — this is the effort
    effortPhase: "extend",
    depthMargin: 6,
    plane: "sagittal",
    shallowCue: "Выше — таз до прямой линии",
    cues: ["Поднимайте таз до прямой линии", "Сжимайте ягодицы наверху", "Не прогибайте поясницу"],
  },
  "heel-toe": {
    key: "heel-toe",
    name: "Ходьба «пятка к носку»",
    emoji: "🦶",
    focus: "Баланс",
    description: "Тренировка равновесия и координации.",
    difficulty: "Лёгкое",
    mode: "balance",
    joint: [23, 24, 26], // hips + knee — used only for visibility framing
    downAngle: 0,
    upAngle: 0,
    cues: ["Ставьте пятку вплотную к носку", "Смотрите вперёд", "Руки в стороны для баланса"],
  },
};

export const EXERCISE_LIST = Object.values(EXERCISES);

export function getExercise(key: ExerciseKey) {
  return EXERCISES[key];
}
