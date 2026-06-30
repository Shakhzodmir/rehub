import { CheckCircle2, Info, TriangleAlert, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { dismissToast, useToasts, type ToastVariant } from "./use-toast";

const ICONS: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
};

const TONE: Record<ToastVariant, string> = {
  default: "text-primary",
  success: "text-success",
  warning: "text-[hsl(var(--warning-foreground))]",
  destructive: "text-destructive",
};

export function Toaster() {
  const toasts = useToasts();

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="Уведомления"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-lg"
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TONE[t.variant])} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-sm text-muted-foreground">{t.description}</div>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Закрыть уведомление"
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
