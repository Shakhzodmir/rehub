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
  | "plank"
  | "heel-toe";

/**
 * Secondary form check evaluated by the pose engine alongside the depth check.
 * kind "angle"   — the a-b-c joint angle must stay inside [min, max]
 * kind "incline" — tilt of the joints[1]→joints[0] segment from vertical (0° = upright)
 */
export interface FormRule {
  id: string;
  kind: "angle" | "incline";
  /** angle: [a, b(vertex), c]; incline: [top, bottom] — right-side indices, mirrored with the tracked side */
  joints: number[];
  min?: number;
  max?: number;
  /** effort = checked only during the effort phase of a rep (default); always = every frame */
  when?: "effort" | "always";
  /** corrective cue spoken/shown when the rule is violated on a rep */
  cue: string;
}

export interface ExerciseDef {
  key: ExerciseKey;
  name: string;
  emoji: string; // decorative only; UI uses Lucide icons
  focus: string;
  description: string;
  difficulty: "Лёгкое" | "Среднее" | "Высокое";
  /** rep = angle state machine; hold = isometric time-in-zone; balance = posture/time */
  mode: "rep" | "hold" | "balance";
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
  /**
   * Camera view the joint angle is only trustworthy from. Off-axis views inflate
   * angle error 3-4× (oblique) up to clinically useless in the transverse plane,
   * so the engine detects the patient's orientation and prompts them to turn.
   * Defaults to "side" for sagittal exercises and "front" for frontal ones.
   */
  view?: "side" | "front";
  /** per-rep corrective cue spoken/shown when the effort peak is too shallow */
  shallowCue?: string;
  /** secondary technique checks (torso lean, hip sag, …) beyond the depth check */
  formRules?: FormRule[];
  /** a rep faster than this (ms, effort start → completion) triggers a tempo cue; omit to skip */
  minTempoMs?: number;
  /** hold mode: target continuous time in the effort zone, seconds */
  holdTargetSec?: number;
  /** auto-pick the better-visible body side (default true for rep/hold) */
  sideSelect?: boolean;
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
  /** average rep tempo, seconds per rep (effort start → completion) */
  avgRepSec?: number;
  /** left/right movement symmetry 0-100, when both sides were visible */
  symmetry?: number;
  /** hold mode: accumulated time in the correct position, seconds */
  holdSec?: number;
  /** per-rep quality trace — lets the clinician see technique decay within a set */
  repHistory?: RepRecord[];
}

export interface RepRecord {
  good: boolean;
  /** effort-extreme angle of the rep, degrees */
  peakAngle: number;
  /** effort start → completion, seconds */
  durationSec?: number;
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
