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
  /** angle thresholds: down = flexed (low angle), up = extended (high angle) */
  downAngle: number;
  upAngle: number;
  /**
   * Which extreme of the movement is the actual effort.
   * "flex" → the contracted/low-angle position (squat down, push-up down). Default.
   * "extend" → the extended/high-angle position (glute-bridge up, jumping-jack arms up).
   */
  effortPhase?: "flex" | "extend";
  /** degrees the effort peak must pass the threshold to count as a clean rep (default 5) */
  depthMargin?: number;
  /** target range of motion in degrees — used for the recovery/ROM metric */
  targetROM?: number;
  /** sagittal = 2D angle (default); frontal/3d = use z to resist foreshortening */
  plane?: "sagittal" | "frontal";
  /** per-rep corrective cue spoken/shown when the effort peak is too shallow */
  shallowCue?: string;
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
  /** patient-reported pain right after the session, NPRS 0-10 */
  painLevel?: number;
  /** peak range of motion (degrees) measured during the session */
  achievedROM?: number;
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
  /** last patient-reported pain (NPRS 0-10) */
  lastPain?: number;
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
