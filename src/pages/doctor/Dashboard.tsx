import { Link } from "react-router-dom";
import { ChevronRight, ClipboardCheck, Clock, FileText, Send, Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REFERRALS } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { referralBadge } from "./referral-status";

export default function DoctorDashboard() {
  const pending = REFERRALS.filter((r) => r.status === "pending").length;
  const inProgress = REFERRALS.filter((r) => r.status === "in-progress").length;
  const completed = REFERRALS.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Кабинет врача"
        description="Направления на реабилитацию и контроль прогресса пациентов."
        actions={
          <Button asChild>
            <Link to="/doctor/referrals">
              <Send className="h-4 w-4" /> Новое направление
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ожидают" value={pending} icon={Clock} hint="требуют назначения" />
        <StatCard label="В реабилитации" value={inProgress} icon={Users} delta={5} />
        <StatCard label="Завершено" value={completed} icon={ClipboardCheck} delta={8} />
        <StatCard label="Всего направлений" value={REFERRALS.length} icon={FileText} delta={14} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Недавние направления</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/doctor/referrals">
              Все <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {REFERRALS.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.patientName}</span>
                  {r.priority === "срочный" && <Badge variant="destructive">срочно</Badge>}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {r.diagnosis} · МКБ {r.icd}
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-xs text-muted-foreground">{formatDate(r.date, { day: "numeric", month: "short" })}</div>
              </div>
              {referralBadge(r.status)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
