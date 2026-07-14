import { toast } from "@/components/ui/use-toast";

/**
 * Honest feedback for actions that need the real backend (Supabase) — a tap
 * must never die silently, even in the demo build.
 */
export function demoAction(feature: string) {
  toast({
    title: feature,
    description: "В демо-версии действие недоступно — подключается вместе с базой данных.",
  });
}
