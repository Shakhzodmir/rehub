import { Link } from "react-router-dom";
import { Activity, ChevronRight, DollarSign, TrendingDown, UserCheck, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ADMIN_METRICS, EXERCISE_USAGE, REVENUE_TREND, AUDIT_LOGS } from "@/lib/mock-data";
import { formatRelative } from "@/lib/utils";
import { severityBadge } from "./severity";

const PIE_COLORS = ["#0891B2", "#22D3EE", "#059669", "#34D399", "#0E7490", "#67E8F9"];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Панель администратора"
        description="Здоровье платформы: финансы, рост и операционные сигналы."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={`$${(ADMIN_METRICS.mrr / 1000).toFixed(1)}K`} icon={DollarSign} delta={ADMIN_METRICS.mrrDelta} />
        <StatCard label="Активные пациенты" value={ADMIN_METRICS.activePatients.toLocaleString("ru-RU")} icon={Users} delta={ADMIN_METRICS.patientsDelta} />
        <StatCard label="Терапевты" value={ADMIN_METRICS.therapists} icon={UserCheck} delta={ADMIN_METRICS.therapistsDelta} />
        <StatCard label="Отток" value={`${ADMIN_METRICS.churn}%`} icon={TrendingDown} delta={ADMIN_METRICS.churnDelta} invertDelta />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Рост выручки</CardTitle>
            <p className="text-sm text-muted-foreground">MRR по месяцам, USD</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={REVENUE_TREND} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(161 84% 36%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(161 84% 36%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 32% 92%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(200 16% 60%)" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }}
                  formatter={(v: number) => [`$${v.toLocaleString("ru-RU")}`, "MRR"]}
                />
                <Area type="monotone" dataKey="mrr" stroke="hsl(161 84% 36%)" strokeWidth={3} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Использование упражнений</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={EXERCISE_USAGE} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                  {EXERCISE_USAGE.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(200 32% 89%)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
              {EXERCISE_USAGE.map((e, i) => (
                <div key={e.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate text-muted-foreground">{e.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Системные события
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/audit">
              Журнал аудита <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {AUDIT_LOGS.slice(0, 4).map((log) => (
            <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              {severityBadge(log.severity)}
              <div className="min-w-0 flex-1">
                <span className="font-medium">{log.action}</span>
                <span className="text-muted-foreground"> · {log.target}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(log.at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
