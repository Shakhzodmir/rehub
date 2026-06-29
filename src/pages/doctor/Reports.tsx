import { Download, FileText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { PATIENTS } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { statusBadge } from "../therapist/status";

export default function DoctorReports() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Отчёты о прогрессе"
        description="Сводки по реабилитации пациентов от терапевтов."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {PATIENTS.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} />
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{p.condition}</p>
                </div>
              </div>
              {statusBadge(p.status)}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" /> Восстановление
                  </span>
                  <span className="font-medium tabular-nums">{p.recoveryProgress}%</span>
                </div>
                <Progress value={p.recoveryProgress} indicatorClassName="bg-accent" />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  Обновлён {formatDate(p.lastActive, { day: "numeric", month: "short" })}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4" /> Открыть
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
