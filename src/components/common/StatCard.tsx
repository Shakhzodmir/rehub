import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  delta?: number; // percentage; positive = up
  hint?: string;
  invertDelta?: boolean; // for metrics where down is good (churn)
}

export function StatCard({ label, value, icon: Icon, delta, hint, invertDelta }: StatCardProps) {
  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              good ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="font-heading text-2xl font-bold tabular-nums">{value}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground/80">{hint}</div>}
      </div>
    </Card>
  );
}
