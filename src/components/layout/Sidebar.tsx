import { NavLink } from "react-router-dom";
import { Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { NAV, ROLE_LABELS } from "./nav-config";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  const nav = NAV[user.role];

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 py-5">
        <NavLink to={nav.home} onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="font-heading text-base font-bold text-white">POSETRACK</div>
            <div className="text-[11px] text-sidebar-foreground/70">{ROLE_LABELS[user.role]}</div>
          </div>
        </NavLink>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="inline-flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent lg:hidden"
            aria-label="Закрыть меню"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Основная навигация">
        {nav.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === nav.home}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent/15 text-white"
                  : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn("h-[18px] w-[18px]", isActive ? "text-sidebar-accent" : "")}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold text-sidebar">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-white/5 p-3 text-xs text-sidebar-foreground/80">
          <p className="font-medium text-white">Демо-режим</p>
          <p className="mt-0.5">Данные локальные (mock). Supabase подключается отдельно.</p>
        </div>
      </div>
    </div>
  );
}
