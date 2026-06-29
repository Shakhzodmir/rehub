import { Link } from "react-router-dom";
import { Activity, Play } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EXERCISE_LIST } from "@/lib/exercises";
import { ACTIVE_PLAN } from "@/lib/mock-data";

const diffVariant = {
  "Лёгкое": "success",
  "Среднее": "warning",
  "Высокое": "destructive",
} as const;

export default function PatientExercises() {
  const inPlan = new Set(ACTIVE_PLAN.exercises.map((e) => e.key));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Упражнения"
        description="Выберите упражнение, чтобы начать тренировку с контролем техники через камеру."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXERCISE_LIST.map((ex) => (
          <Card key={ex.key} className="flex flex-col overflow-hidden">
            <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              <Activity className="h-10 w-10 text-primary" />
              {inPlan.has(ex.key) && (
                <Badge variant="default" className="absolute right-3 top-3">
                  В вашем плане
                </Badge>
              )}
            </div>
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading font-semibold">{ex.name}</h3>
                  <p className="text-sm text-muted-foreground">{ex.focus}</p>
                </div>
                <Badge variant={diffVariant[ex.difficulty]}>{ex.difficulty}</Badge>
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{ex.description}</p>
              <Button asChild className="mt-1 w-full">
                <Link to={`/patient/session/${ex.key}`}>
                  <Play className="h-4 w-4" />
                  Начать
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
