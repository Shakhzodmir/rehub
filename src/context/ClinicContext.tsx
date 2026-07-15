import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Patient, TreatmentPlan } from "@/lib/types";
import { PATIENTS as PATIENT_SEED, PLANS as PLAN_SEED, USERS } from "@/lib/mock-data";

const STORAGE_KEY = "posetrack.clinic.v1";

interface ClinicData {
  patients: Patient[];
  plans: TreatmentPlan[];
}

function load(): ClinicData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ClinicData;
      if (Array.isArray(parsed.patients) && Array.isArray(parsed.plans)) return parsed;
    }
  } catch {
    /* corrupted storage — fall back to seed */
  }
  return { patients: PATIENT_SEED, plans: PLAN_SEED };
}

function persist(data: ClinicData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full / unavailable — non-fatal, keep in-memory */
  }
}

export interface NewPatientInput {
  name: string;
  age: number;
  condition: string;
  email?: string;
}

export type PlanInput = Omit<TreatmentPlan, "id" | "createdAt" | "therapistId">;

interface ClinicState {
  patients: Patient[];
  plans: TreatmentPlan[];
  addPatient: (input: NewPatientInput) => Patient;
  addPlan: (input: PlanInput) => TreatmentPlan;
  updatePlan: (id: string, patch: Partial<TreatmentPlan>) => void;
  /** the patient's active plan, else their most recent one */
  planFor: (patientId: string) => TreatmentPlan | undefined;
}

const ClinicContext = createContext<ClinicState | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ClinicData>(load);

  const mutate = useCallback((fn: (prev: ClinicData) => ClinicData) => {
    setData((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const addPatient = useCallback(
    (input: NewPatientInput) => {
      const patient: Patient = {
        id: `p-${Date.now()}`,
        name: input.name,
        email: input.email || `${Date.now()}@demo.health`,
        age: input.age,
        condition: input.condition,
        therapistId: USERS.therapist.id,
        adherence: 0,
        status: "active",
        recoveryProgress: 0,
        lastActive: new Date().toISOString(),
        startedAt: new Date().toISOString().slice(0, 10),
      };
      mutate((prev) => ({ ...prev, patients: [patient, ...prev.patients] }));
      return patient;
    },
    [mutate]
  );

  const addPlan = useCallback(
    (input: PlanInput) => {
      const plan: TreatmentPlan = {
        ...input,
        id: `plan-${Date.now()}`,
        therapistId: USERS.therapist.id,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      mutate((prev) => ({ ...prev, plans: [plan, ...prev.plans] }));
      return plan;
    },
    [mutate]
  );

  const updatePlan = useCallback(
    (id: string, patch: Partial<TreatmentPlan>) => {
      mutate((prev) => ({
        ...prev,
        plans: prev.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [mutate]
  );

  const planFor = useCallback(
    (patientId: string) => {
      const own = data.plans.filter((p) => p.patientId === patientId);
      return own.find((p) => p.status === "active") ?? own[0];
    },
    [data.plans]
  );

  const value = useMemo(
    () => ({ patients: data.patients, plans: data.plans, addPatient, addPlan, updatePlan, planFor }),
    [data, addPatient, addPlan, updatePlan, planFor]
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used within ClinicProvider");
  return ctx;
}
