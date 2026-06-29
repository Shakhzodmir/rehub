import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "@/lib/types";
import { USERS } from "@/lib/mock-data";

interface AuthState {
  user: User | null;
  loginAs: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "posetrack.role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Role | null;
    return saved && USERS[saved] ? USERS[saved] : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, user.role);
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const loginAs = (role: Role) => setUser(USERS[role]);
  const logout = () => setUser(null);

  return <AuthContext.Provider value={{ user, loginAs, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
