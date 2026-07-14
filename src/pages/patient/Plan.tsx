import { Link } from "react-router-dom";
import { Activity, FileText, Play, Stethoscope, Target } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ACTIVE_PLAN, USERS } from "@/lib/mock-data";
import { doseLabel, getExercise } from "@/lib/exercises";
import { formatDate } from "@/lib/utils";

export default function PatientPlan() {
  const plan = ACTIVE_PLAN;
  const therapist = USERS.therapist;

  return (
    <div className="space-y-6">
      <PageHeader title="Мой план лечения" description={plan.title} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Назначенные упражнения</CardTitle>
            <Badge variant="success">Активен</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.exercises.map((pe) => {
              const ex = getExercise(pe.key);
              return (
                <div
                  key={pe.key}
                  className="flex items-center gap-4 rounded-lg border border-border p-4"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Activity className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-sm text-muted-foreground">{doseLabel(pe)}</div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/patient/session/${pe.key}`}>
                      <Play className="h-3.5 w-3.5" /> Начать
                    </Link>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Диагноз</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{plan.diagnosis}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">МКБ {plan.icd}</Badge>
                <span className="text-muted-foreground">от {formatDate(plan.createdAt)}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                <span className="text-muted-foreground">{plan.notes}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ваш терапевт</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium">{therapist.name}</div>
                  <div className="text-sm text-muted-foreground">{therapist.title}</div>
                </div>
              </div>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/patient/messages">Написать сообщение</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
