import { Badge } from "@/components/ui/badge";
import type { Patient } from "@/lib/types";

const MAP: Record<Patient["status"], { label: string; variant: "success" | "warning" | "secondary" }> = {
  active: { label: "Активен", variant: "success" },
  "at-risk": { label: "Под угрозой", variant: "warning" },
  discharged: { label: "Выписан", variant: "secondary" },
};

export function statusBadge(status: Patient["status"]) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
