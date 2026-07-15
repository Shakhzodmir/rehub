import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, Users, Activity, TrendingUp, CheckCircle2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { EXERCISE_USAGE } from "@/lib/mock-data";
import { useClinic } from "@/context/ClinicContext";
import { formatRelative } from "@/lib/utils";
import { statusBadge } from "./status";

export default function TherapistDashboard() {
  const { patients } = useClinic();
  const active = patients.filter((p) => p.status === "active");
  const atRisk = patients.filter((p) => p.status === "at-risk");
  const avgAdherence = patients.length
    ? Math.round(patients.reduce((s, p) => s + p.adherence, 0) / patients.length)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Обзор практики"
        description="Состояние пациентов, приверженность и сигналы риска."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Активные пациенты" value={active.length} icon={Users} delta={9} />
        <StatCard label="Под угрозой" value={atRisk.length} icon={AlertTriangle} hint="нужно вмешательство" />
        <StatCard label="Ср. приверженность" value={`${avgAdherence}%`} icon={TrendingUp} delta={4} />
        <StatCard label="Сессий сегодня" value={18} icon={Activity} delta={12} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Мои пациенты</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/therapist/patients">
                Все <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {patients.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                to={`/therapist/patients/${p.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
              >
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    {statusBadge(p.status)}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{p.condition}</div>
                </div>
                <div className="hidden w-28 sm:block">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>план</span>
                    <span className="tabular-nums">{p.adherence}%</span>
                  </div>
                  <Progress
                    value={p.adherence}
                    indicatorClassName={p.adherence < 50 ? "bg-destructive" : "bg-accent"}
                  />
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" /> Требуют внимания
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {atRisk.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Все пациенты в норме
                </p>
              )}
              {atRisk.map((p) => (
                <Link
                  key={p.id}
                  to={`/therapist/patients/${p.id}`}
                  className="block rounded-lg bg-card p-3 text-sm shadow-sm"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-muted-foreground">
                    Неактивен · {formatRelative(p.lastActive)} · приверженность {p.adherence}%
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Популярные упражнения</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={EXERCISE_USAGE.slice(0, 5)} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(200 32% 92%)" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }} cursor={{ fill: "hsl(200 38% 96%)" }} />
                  <Bar dataKey="value" fill="hsl(192 91% 40%)" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
