import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WorkoutSession } from "@/lib/types";
import { SESSIONS as SEED } from "@/lib/mock-data";

const STORAGE_KEY = "posetrack.sessions";

function loadAdded(): WorkoutSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as WorkoutSession[]) : [];
  } catch {
    return [];
  }
}

function persist(added: WorkoutSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(added));
  } catch {
    /* storage full / unavailable — non-fatal, keep in-memory */
  }
}

interface SessionsState {
  /** seed + user-recorded sessions, newest first */
  sessions: WorkoutSession[];
  addSession: (s: Omit<WorkoutSession, "id">) => WorkoutSession;
  sessionsFor: (patientId: string) => WorkoutSession[];
}

const SessionsContext = createContext<SessionsState | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [added, setAdded] = useState<WorkoutSession[]>(loadAdded);

  const addSession = useCallback((s: Omit<WorkoutSession, "id">) => {
    const record: WorkoutSession = { ...s, id: `s-${Date.now()}` };
    setAdded((prev) => {
      const next = [record, ...prev];
      persist(next);
      return next;
    });
    return record;
  }, []);

  const sessions = useMemo(
    () =>
      [...added, ...SEED].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [added]
  );

  const sessionsFor = useCallback(
    (patientId: string) => sessions.filter((s) => s.patientId === patientId),
    [sessions]
  );

  const value = useMemo(
    () => ({ sessions, addSession, sessionsFor }),
    [sessions, addSession, sessionsFor]
  );

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useSessions must be used within SessionsProvider");
  return ctx;
}
