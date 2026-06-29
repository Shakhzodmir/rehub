import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/types";
import { USERS } from "@/lib/mock-data";
import { EXERCISE_LIST } from "@/lib/exercises";
import { cn } from "@/lib/utils";

const ROLE_CARDS: { role: Role; icon: typeof User; desc: string; tint: string }[] = [
  { role: "patient", icon: User, desc: "Тренировки с контролем техники через камеру", tint: "text-primary bg-primary/10" },
  { role: "therapist", icon: ClipboardList, desc: "Пациенты, планы лечения и оценки", tint: "text-accent bg-accent/10" },
  { role: "doctor", icon: Stethoscope, desc: "Направления и проверка прогресса", tint: "text-primary bg-primary/10" },
  { role: "admin", icon: ShieldCheck, desc: "Аналитика, пользователи, библиотека", tint: "text-accent bg-accent/10" },
];

const ROLE_TITLE: Record<Role, string> = {
  patient: "Пациент",
  therapist: "Терапевт",
  doctor: "Врач",
  admin: "Администратор",
};

export default function Login() {
  const { loginAs } = useAuth();
  const navigate = useNavigate();

  const enter = (role: Role) => {
    loginAs(role);
    navigate(`/${role}`);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sidebar-accent/20 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar">
              <Activity className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <span className="font-heading text-xl font-bold">POSETRACK</span>
          </div>
          <h1 className="mt-12 font-heading text-4xl font-bold leading-tight">
            Дистанционная реабилитация под контролем ИИ
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground">
            Пациенты выполняют упражнения дома, а компьютерное зрение в реальном времени
            отслеживает технику, считает повторения и фиксирует ошибки.
          </p>

          <div className="mt-10 flex items-center gap-2 text-sm text-sidebar-foreground">
            <ScanLine className="h-4 w-4 text-sidebar-accent" />
            Анализ позы на MediaPipe · 33 точки · подсчёт по углам суставов
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-2">
          {EXERCISE_LIST.map((ex) => (
            <div
              key={ex.key}
              className="rounded-lg border border-sidebar-border bg-white/5 px-3 py-2.5 text-sm"
            >
              <div className="font-medium text-white">{ex.name}</div>
              <div className="text-xs text-sidebar-foreground/70">{ex.focus}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Role selection */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Activity className="h-6 w-6" strokeWidth={2.5} />
              </span>
              <span className="font-heading text-xl font-bold">POSETRACK</span>
            </div>
          </div>

          <Badge variant="secondary" className="mb-3">Демо · выбор роли</Badge>
          <h2 className="font-heading text-2xl font-bold">Войти в систему</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Выберите роль, чтобы открыть соответствующий рабочий кабинет.
          </p>

          <div className="mt-6 space-y-3">
            {ROLE_CARDS.map(({ role, icon: Icon, desc, tint }) => (
              <button
                key={role}
                onClick={() => enter(role)}
                className="group w-full text-left focus-visible:outline-none"
              >
                <Card className="flex items-center gap-4 p-4 transition-all hover:border-primary/40 hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", tint)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-semibold">{ROLE_TITLE[role]}</div>
                    <div className="truncate text-sm text-muted-foreground">{desc}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground/70">{USERS[role].name}</div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Card>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Демо-доступ. Данные хранятся локально (mock). Авторизация Supabase подключается позже.
          </p>
        </div>
      </div>
    </div>
  );
}
