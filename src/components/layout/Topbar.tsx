import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Repeat } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS } from "./nav-config";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenu}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="hidden text-muted-foreground sm:inline-flex"
        >
          <Repeat className="h-4 w-4" />
          Сменить роль
        </Button>

        <button
          className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Уведомления"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </button>

        <div className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1 pl-1 pr-3">
          <Avatar name={user.name} className="h-8 w-8" />
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            logout();
            navigate("/login");
          }}
          aria-label="Выйти"
          className="text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
