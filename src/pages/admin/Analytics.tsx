import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, Repeat, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_METRICS, EXERCISE_USAGE, REVENUE_TREND } from "@/lib/mock-data";

export default function AdminAnalytics() {
  return (
    <div className="space-y-6">
      <PageHeader title="Аналитика" description="Финансовые и продуктовые метрики платформы." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={`$${(ADMIN_METRICS.mrr / 1000).toFixed(1)}K`} icon={DollarSign} delta={ADMIN_METRICS.mrrDelta} />
        <StatCard label="ARPU" value={`$${ADMIN_METRICS.arpu}`} icon={TrendingUp} delta={3.2} />
        <StatCard label="Отток" value={`${ADMIN_METRICS.churn}%`} icon={Repeat} delta={ADMIN_METRICS.churnDelta} invertDelta />
        <StatCard label="Пациенты" value={ADMIN_METRICS.activePatients.toLocaleString("ru-RU")} icon={Users} delta={ADMIN_METRICS.patientsDelta} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Выручка и пациенты</CardTitle>
          <p className="text-sm text-muted-foreground">Корреляция роста MRR с числом активных пациентов</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={REVENUE_TREND} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 32% 92%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="mrr" name="MRR ($)" stroke="hsl(161 84% 36%)" strokeWidth={3} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="patients" name="Пациенты" stroke="hsl(192 91% 40%)" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Популярность упражнений</CardTitle>
          <p className="text-sm text-muted-foreground">Количество выполненных сессий</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={EXERCISE_USAGE} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 32% 92%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }} cursor={{ fill: "hsl(200 38% 96%)" }} />
              <Bar dataKey="value" name="Сессии" fill="hsl(192 91% 40%)" radius={[6, 6, 0, 0]} barSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
