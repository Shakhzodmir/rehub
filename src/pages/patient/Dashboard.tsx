import { Link } from "react-router-dom";
import {
  Activity,
  CalendarClock,
  ChevronRight,
  Flame,
  Play,
  Target,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/context/AuthContext";
import { ACTIVE_PLAN, ADHERENCE_TREND, APPOINTMENTS, SESSIONS } from "@/lib/mock-data";
import { getExercise } from "@/lib/exercises";
import { formatDate, formatRelative } from "@/lib/utils";

export default function PatientDashboard() {
  const { user } = useAuth();
  const todayTargetSets = ACTIVE_PLAN.exercises.reduce((s, e) => s + e.targetSets, 0);
  const todaySessions = SESSIONS.filter(
    (s) => new Date(s.date).toDateString() === new Date().toDateString()
  );
  const doneSets = todaySessions.length;
  const dayProgress = Math.round((doneSets / todayTargetSets) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Добрый день, ${user?.name.split(" ")[0]}!`}
        description="Вот ваша программа на сегодня и общий прогресс восстановления."
        actions={
          <Button asChild>
            <Link to="/patient/exercises">
              <Play className="h-4 w-4" />
              Начать тренировку
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Восстановление" value="64%" icon={TrendingUp} delta={6} hint="Цель ROM 135°" />
        <StatCard label="Приверженность" value="86%" icon={Target} delta={4} hint="за 30 дней" />
        <StatCard label="Серия дней" value="9" icon={Flame} hint="не пропускайте!" />
        <StatCard label="Сессий всего" value={SESSIONS.length * 6} icon={Activity} delta={12} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's plan */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>План на сегодня</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{ACTIVE_PLAN.title}</p>
            </div>
            <Badge variant={dayProgress >= 100 ? "success" : "default"}>
              {doneSets}/{todayTargetSets} подходов
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={dayProgress} indicatorClassName="bg-accent" label="Прогресс дня" />
            <div className="divide-y divide-border rounded-lg border border-border">
              {ACTIVE_PLAN.exercises.map((pe) => {
                const ex = getExercise(pe.key);
                const done = todaySessions.some((s) => s.exercise === pe.key);
                return (
                  <Link
                    key={pe.key}
                    to={`/patient/session/${pe.key}`}
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {pe.targetSets} × {pe.targetReps} повт.
                        {pe.holdSeconds ? ` · удержание ${pe.holdSeconds}с` : ""}
                      </div>
                    </div>
                    {done ? (
                      <Badge variant="success">Выполнено</Badge>
                    ) : (
                      <Button size="sm" variant="outline">
                        <Play className="h-3.5 w-3.5" />
                        Начать
                      </Button>
                    )}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recovery trend */}
        <Card>
          <CardHeader>
            <CardTitle>Динамика восстановления</CardTitle>
            <p className="text-sm text-muted-foreground">Приверженность по неделям</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={ADHERENCE_TREND} margin={{ left: -20, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="adh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(192 91% 40%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(192 91% 40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Приверженность"]}
                />
                <Area type="monotone" dataKey="adherence" stroke="hsl(192 91% 40%)" strokeWidth={2.5} fill="url(#adh)" />
              </AreaChart>
            </ResponsiveContainer>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-muted-foreground" /> Ближайшие записи
              </h4>
              {APPOINTMENTS.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.with}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(a.at, { day: "numeric", month: "short" })}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Недавняя активность</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/patient/progress">
              Весь прогресс <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {SESSIONS.slice(0, 5).map((s) => {
            const ex = getExercise(s.exercise);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{ex.name}</div>
                  <div className="text-xs text-muted-foreground">{formatRelative(s.date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium tabular-nums">
                    {s.reps}/{s.targetReps} повт.
                  </div>
                  <Badge variant={s.formScore >= 85 ? "success" : s.formScore >= 75 ? "warning" : "destructive"} className="mt-0.5">
                    Техника {s.formScore}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
