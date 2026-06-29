import { PageHeader } from "@/components/common/PageHeader";
import { ChatThread } from "@/components/common/ChatThread";
import { MESSAGES, USERS } from "@/lib/mock-data";

export default function PatientMessages() {
  return (
    <div className="space-y-6">
      <PageHeader title="Сообщения" description="Прямая связь с вашим терапевтом." />
      <ChatThread
        title={USERS.therapist.name}
        subtitle={USERS.therapist.title}
        initial={MESSAGES}
        selfName={USERS.patient.name}
      />
    </div>
  );
}
