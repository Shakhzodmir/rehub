import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "info" | "warning" | "error";

const MAP: Record<Severity, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "bg-primary/10 text-primary" },
  warning: { icon: AlertTriangle, className: "bg-warning/15 text-[hsl(var(--warning-foreground))]" },
  error: { icon: AlertCircle, className: "bg-destructive/12 text-destructive" },
};

export function severityBadge(severity: Severity) {
  const s = MAP[severity];
  const Icon = s.icon;
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", s.className)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}
