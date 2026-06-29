export type Role = "patient" | "therapist" | "doctor" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  title?: string; // specialty / position
}

export type ExerciseKey =
  | "squats"
  | "pushups"
  | "jumping-jacks"
  | "lunges"
  | "glute-bridge"
  | "heel-toe";

export interface ExerciseDef {
  key: ExerciseKey;
  name: string;
  emoji: string; // decorative only; UI uses Lucide icons
  focus: string;
  description: string;
  difficulty: "Лёгкое" | "Среднее" | "Высокое";
  /** rep = angle-based state machine; balance = posture/time based */
  mode: "rep" | "balance";
  /** joints tracked for the rep state-machine */
  joint: [number, number, number]; // [a, b(vertex), c] MediaPipe landmark indices
  /** angle thresholds: down = contracted (flexed), up = extended */
  downAngle: number;
  upAngle: number;
  cues: string[];
}

export interface PlanExercise {
  key: ExerciseKey;
  targetReps: number;
  targetSets: number;
  holdSeconds?: number;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  therapistId: string;
  title: string;
  status: "active" | "paused" | "completed";
  createdAt: string;
  diagnosis: string;
  icd: string;
  exercises: PlanExercise[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  patientId: string;
  date: string;
  exercise: ExerciseKey;
  reps: number;
  targetReps: number;
  durationSec: number;
  formScore: number; // 0-100
  violations: number;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  age: number;
  condition: string;
  therapistId: string;
  adherence: number; // 0-100
  status: "active" | "at-risk" | "discharged";
  recoveryProgress: number; // 0-100
  lastActive: string;
  startedAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  fromId: string;
  fromName: string;
  text: string;
  at: string;
  mine?: boolean;
}

export interface Referral {
  id: string;
  patientName: string;
  doctorName: string;
  diagnosis: string;
  icd: string;
  status: "pending" | "accepted" | "in-progress" | "completed";
  date: string;
  priority: "обычный" | "срочный";
}

export interface Appointment {
  id: string;
  title: string;
  with: string;
  at: string;
  kind: "assessment" | "follow-up" | "consult";
}
