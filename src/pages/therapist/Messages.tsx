import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ChatThread } from "@/components/common/ChatThread";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MESSAGES, PATIENTS, USERS } from "@/lib/mock-data";
import type { Message } from "@/lib/types";

const threadFor = (patientId: string, patientName: string): Message[] => {
  if (patientId === "p-1") return MESSAGES;
  return [
    {
      id: `seed-${patientId}`,
      threadId: `t-${patientId}`,
      fromId: patientId,
      fromName: patientName,
      text: "Здравствуйте! Готов(а) к новым упражнениям на этой неделе.",
      at: new Date(Date.now() - 2 * 86400_000).toISOString(),
      mine: false,
    },
  ];
};

export default function TherapistMessages() {
  const contacts = PATIENTS.filter((p) => p.status !== "discharged");
  const [activeId, setActiveId] = useState(contacts[0].id);
  const active = contacts.find((c) => c.id === activeId)!;

  return (
    <div className="space-y-6">
      <PageHeader title="Сообщения" description="Переписка с пациентами." />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-1 rounded-xl border border-border bg-card p-2">
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
                c.id === activeId ? "bg-primary/10" : "hover:bg-muted"
              )}
            >
              <Avatar name={c.name} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">{c.condition}</div>
              </div>
            </button>
          ))}
        </div>

        <ChatThread
          key={active.id}
          title={active.name}
          subtitle={active.condition}
          initial={threadFor(active.id, active.name)}
          selfName={USERS.therapist.name}
        />
      </div>
    </div>
  );
}
