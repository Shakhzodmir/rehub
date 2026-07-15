import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanFormDialog } from "@/components/therapist/PlanFormDialog";
import { useClinic } from "@/context/ClinicContext";
import { getExercise } from "@/lib/exercises";
import { formatDate } from "@/lib/utils";

const STATUS = {
  active: { label: "Активен", variant: "success" as const },
  paused: { label: "Пауза", variant: "warning" as const },
  completed: { label: "Завершён", variant: "secondary" as const },
};

export default function TherapistPlans() {
  const { plans, patients } = useClinic();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Планы лечения"
        description="Протоколы упражнений, назначенные пациентам."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Новый план
          </Button>
        }
      />
      <PlanFormDialog open={creating} onClose={() => setCreating(false)} />

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const patient = patients.find((p) => p.id === plan.patientId);
          const st = STATUS[plan.status];
          return (
            <Card key={plan.id}>
              <CardHeader className="flex-row items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {patient?.name} · МКБ {plan.icd}
                    </p>
                  </div>
                </div>
                <Badge variant={st.variant}>{st.label}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {plan.exercises.map((pe) => (
                    <Badge key={pe.key} variant="outline">
                      {getExercise(pe.key).name} · {pe.targetSets}×{pe.targetReps}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
                  <span>от {formatDate(plan.createdAt)}</span>
                  {patient && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/therapist/patients/${patient.id}`}>Открыть пациента</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
