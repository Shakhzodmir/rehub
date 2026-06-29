import { Badge } from "@/components/ui/badge";
import type { Referral } from "@/lib/types";

const MAP: Record<Referral["status"], { label: string; variant: "success" | "warning" | "default" | "secondary" }> = {
  pending: { label: "Ожидает", variant: "warning" },
  accepted: { label: "Принято", variant: "default" },
  "in-progress": { label: "В работе", variant: "default" },
  completed: { label: "Завершено", variant: "success" },
};

export function referralBadge(status: Referral["status"]) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
