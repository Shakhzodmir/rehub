import {
  Activity,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Dumbbell,
  FileText,
  Home,
  LineChart,
  MessageSquare,
  ScrollText,
  Send,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
}

export const NAV: Record<Role, { home: string; items: NavItem[] }> = {
  patient: {
    home: "/patient",
    items: [
      { label: "Обзор", to: "/patient", icon: Home },
      { label: "Упражнения", to: "/patient/exercises", icon: Dumbbell },
      { label: "Мой план", to: "/patient/plan", icon: ClipboardList },
      { label: "Прогресс", to: "/patient/progress", icon: LineChart },
      { label: "Сообщения", to: "/patient/messages", icon: MessageSquare },
    ],
  },
  therapist: {
    home: "/therapist",
    items: [
      { label: "Обзор", to: "/therapist", icon: Home },
      { label: "Пациенты", to: "/therapist/patients", icon: Users },
      { label: "Планы лечения", to: "/therapist/plans", icon: ClipboardList },
      { label: "Сообщения", to: "/therapist/messages", icon: MessageSquare },
    ],
  },
  doctor: {
    home: "/doctor",
    items: [
      { label: "Обзор", to: "/doctor", icon: Home },
      { label: "Направления", to: "/doctor/referrals", icon: Send },
      { label: "Отчёты", to: "/doctor/reports", icon: FileText },
    ],
  },
  admin: {
    home: "/admin",
    items: [
      { label: "Обзор", to: "/admin", icon: Home },
      { label: "Аналитика", to: "/admin/analytics", icon: BarChart3 },
      { label: "Библиотека упражнений", to: "/admin/exercises", icon: Activity },
      { label: "Пользователи", to: "/admin/users", icon: Users },
      { label: "Журнал аудита", to: "/admin/audit", icon: ScrollText },
    ],
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  patient: "Пациент",
  therapist: "Терапевт",
  doctor: "Врач",
  admin: "Администратор",
};

export const ROLE_ICONS: Record<Role, LucideIcon> = {
  patient: Activity,
  therapist: ClipboardList,
  doctor: ShieldCheck,
  admin: CalendarCheck,
};
