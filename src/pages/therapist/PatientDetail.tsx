import { Link, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  FileText,
  MessageSquare,
  Pencil,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PATIENTS, PLANS, ROM_TREND, SESSIONS } from "@/lib/mock-data";
import { getExercise } from "@/lib/exercises";
import { formatDate } from "@/lib/utils";
import { statusBadge } from "./status";

export default function TherapistPatientDetail() {
  const { id } = useParams<{ id: string }>();
  const patient = PATIENTS.find((p) => p.id === id);
  const plan = PLANS.find((pl) => pl.patientId === id);
  const sessions = SESSIONS.filter((s) => s.patientId === id);

  if (!patient) {
    return (
      <div className="space-y-4">
        <p>Пациент не найден.</p>
        <Button asChild variant="outline">
          <Link to="/therapist/patients">
            <ArrowLeft className="h-4 w-4" /> К списку
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/therapist/patients">
          <ArrowLeft className="h-4 w-4" /> Все пациенты
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={patient.name} className="h-14 w-14 text-lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">{patient.name}</h1>
              {statusBadge(patient.status)}
            </div>
            <p className="text-sm text-muted-foreground">
              {patient.age} лет · {patient.condition}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/therapist/messages">
              <MessageSquare className="h-4 w-4" /> Написать
            </Link>
          </Button>
          <Button>
            <Pencil className="h-4 w-4" /> Изменить план
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Восстановление" value={`${patient.recoveryProgress}%`} progress={patient.recoveryProgress} />
        <MiniStat label="Приверженность" value={`${patient.adherence}%`} progress={patient.adherence} />
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> В программе с
          </div>
          <div className="mt-2 font-heading text-xl font-bold">{formatDate(patient.startedAt)}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Динамика ROM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={ROM_TREND} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(192 91% 40%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(192 91% 40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }} />
                <Area type="monotone" dataKey="rom" stroke="hsl(192 91% 40%)" strokeWidth={3} fill="url(#rom)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">План лечения</CardTitle>
            {plan && <Badge variant={plan.status === "active" ? "success" : "secondary"}>{plan.status === "active" ? "Активен" : "Пауза"}</Badge>}
          </CardHeader>
          <CardContent className="space-y-3">
            {plan ? (
              <>
                <div className="text-sm">
                  <div className="font-medium">{plan.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> МКБ {plan.icd}
                  </div>
                </div>
                {plan.exercises.map((pe) => (
                  <div key={pe.key} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2.5 text-sm">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="flex-1">{getExercise(pe.key).name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {pe.targetSets}×{pe.targetReps}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">План ещё не назначен.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>История сессий</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {sessions.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Дата</TH>
                  <TH>Упражнение</TH>
                  <TH>Повторения</TH>
                  <TH>Техника</TH>
                  <TH>Ошибки</TH>
                </TR>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id}>
                    <TD className="text-muted-foreground">{formatDate(s.date, { day: "numeric", month: "short" })}</TD>
                    <TD className="font-medium">{getExercise(s.exercise).name}</TD>
                    <TD className="tabular-nums">{s.reps}/{s.targetReps}</TD>
                    <TD>
                      <Badge variant={s.formScore >= 85 ? "success" : s.formScore >= 75 ? "warning" : "destructive"}>
                        {s.formScore}%
                      </Badge>
                    </TD>
                    <TD className="tabular-nums text-muted-foreground">{s.violations}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Сессий пока нет.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-2xl font-bold tabular-nums">{value}</div>
      <Progress value={progress} className="mt-3" indicatorClassName="bg-accent" />
    </Card>
  );
}
