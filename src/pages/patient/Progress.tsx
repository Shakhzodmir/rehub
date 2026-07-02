import { useMemo, useState } from "react";
import { Activity, HeartPulse, TrendingUp } from "lucide-react";
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
import { useSessions } from "@/context/SessionsContext";
import { CURRENT_PATIENT_ID } from "@/lib/mock-data";
import { getExercise } from "@/lib/exercises";
import { formatDate } from "@/lib/utils";

const KNEE_TARGET_ROM = 135;

function pctDelta(latest: number, prev: number) {
  return prev > 0 ? Math.round(((latest - prev) / prev) * 100) : undefined;
}

export default function PatientProgress() {
  const [metric, setMetric] = useState("rom");
  const { sessionsFor } = useSessions();
  const mySessions = sessionsFor(CURRENT_PATIENT_ID); // newest first

  const withROM = mySessions.filter((s) => s.achievedROM);
  const withPain = mySessions.filter((s) => s.painLevel != null);

  const latestROM = withROM[0]?.achievedROM ?? 0;
  const romDelta = pctDelta(latestROM, withROM[1]?.achievedROM ?? latestROM);
  const latestPain = withPain[0]?.painLevel;
  const painDelta =
    latestPain != null && withPain[1]?.painLevel != null
      ? pctDelta(latestPain, withPain[1]!.painLevel!)
      : undefined;
  const avgForm = mySessions.length
    ? Math.round(mySessions.reduce((a, s) => a + s.formScore, 0) / mySessions.length)
    : 0;

  // chronological series for the chart (oldest → newest)
  const series = useMemo(
    () =>
      [...mySessions].reverse().map((s) => ({
        label: formatDate(s.date, { day: "numeric", month: "short" }),
        rom: s.achievedROM ?? null,
        pain: s.painLevel ?? null,
        target: KNEE_TARGET_ROM,
      })),
    [mySessions]
  );

  const isROM = metric === "rom";
  const dataKey = isROM ? "rom" : "pain";
  const color = isROM ? "hsl(192 91% 40%)" : "hsl(0 72% 51%)";

  return (
    <div className="space-y-6">
      <PageHeader title="Мой прогресс" description="Динамика восстановления и история тренировок." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Текущий ROM" value={latestROM ? `${latestROM}°` : "—"} icon={TrendingUp} delta={romDelta} hint={`цель ${KNEE_TARGET_ROM}°`} />
        <StatCard
          label="Боль (0–10)"
          value={latestPain != null ? latestPain : "—"}
          icon={HeartPulse}
          delta={painDelta}
          invertDelta
          hint="по последней сессии"
        />
        <StatCard label="Тренировок" value={mySessions.length} icon={Activity} />
        <StatCard label="Средняя техника" value={`${avgForm}%`} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Динамика по тренировкам</CardTitle>
          <Tabs
            value={metric}
            onChange={setMetric}
            tabs={[
              { value: "rom", label: "ROM колена" },
              { value: "pain", label: "Боль" },
            ]}
          />
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Данных пока нет — завершите тренировку, чтобы увидеть динамику.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={series} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 32% 92%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(200 16% 50%)" tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(200 16% 50%)"
                  tickLine={false}
                  axisLine={false}
                  domain={isROM ? [0, 180] : [0, 10]}
                />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }} />
                {isROM && (
                  <Line type="monotone" dataKey="target" stroke="hsl(160 84% 36%)" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Цель" />
                )}
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls
                  name={isROM ? "ROM" : "Боль"}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
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
                <TH>Темп</TH>
                <TH>Боль</TH>
                <TH>Ошибки</TH>
              </TR>
            </THead>
            <TBody>
              {mySessions.map((s) => (
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
                  <TD className="tabular-nums text-muted-foreground">
                    {s.avgRepSec != null
                      ? `${s.avgRepSec.toFixed(1)} с`
                      : s.holdSec != null
                        ? `уд. ${s.holdSec} с`
                        : "—"}
                  </TD>
                  <TD className="tabular-nums text-muted-foreground">{s.painLevel != null ? `${s.painLevel}/10` : "—"}</TD>
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
