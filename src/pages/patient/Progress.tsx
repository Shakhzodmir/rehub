import { useState } from "react";
import { Activity, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ADHERENCE_TREND, ROM_TREND, SESSIONS } from "@/lib/mock-data";
import { getExercise } from "@/lib/exercises";
import { formatDate } from "@/lib/utils";

export default function PatientProgress() {
  const [metric, setMetric] = useState("rom");
  const data = metric === "rom" ? ROM_TREND : ADHERENCE_TREND;
  const dataKey = metric === "rom" ? "rom" : "adherence";

  return (
    <div className="space-y-6">
      <PageHeader title="Мой прогресс" description="Динамика восстановления и история тренировок." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Текущий ROM" value="128°" icon={TrendingUp} delta={6} hint="цель 135°" />
        <StatCard label="Боль (0–10)" value="3" icon={Activity} delta={-25} invertDelta hint="снижение" />
        <StatCard label="Тренировок" value={SESSIONS.length} icon={Activity} delta={12} />
        <StatCard label="Средняя техника" value="86%" icon={TrendingUp} delta={5} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Динамика по неделям</CardTitle>
          <Tabs
            value={metric}
            onChange={setMetric}
            tabs={[
              { value: "rom", label: "ROM колена" },
              { value: "adherence", label: "Приверженность" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 32% 92%)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }} />
              {metric === "rom" && (
                <Line type="monotone" dataKey="target" stroke="hsl(160 84% 36%)" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Цель" />
              )}
              <Line type="monotone" dataKey={dataKey} stroke="hsl(192 91% 40%)" strokeWidth={3} dot={{ r: 4 }} name={metric === "rom" ? "ROM" : "Приверженность"} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История тренировок</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
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
              {SESSIONS.map((s) => (
                <TR key={s.id}>
                  <TD className="text-muted-foreground">{formatDate(s.date, { day: "numeric", month: "short" })}</TD>
                  <TD className="font-medium">{getExercise(s.exercise).name}</TD>
                  <TD className="tabular-nums">
                    {s.reps}/{s.targetReps}
                  </TD>
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
        </CardContent>
      </Card>
    </div>
  );
}
