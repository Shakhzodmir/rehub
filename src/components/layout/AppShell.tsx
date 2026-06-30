import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Sheet } from "@/components/ui/dialog";
import type { Role } from "@/lib/types";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ role }: { role: Role }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 w-64">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer — accessible Sheet (focus trap, Escape, scroll lock) */}
      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} side="left" ariaLabel="Меню навигации">
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className={cn("flex-1 px-4 py-6 sm:px-6 lg:px-8")}>
          <div className="mx-auto w-full max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
