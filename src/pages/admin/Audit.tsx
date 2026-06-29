import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { AUDIT_LOGS } from "@/lib/mock-data";
import { formatDate, formatRelative } from "@/lib/utils";
import { severityBadge } from "./severity";

export default function AdminAudit() {
  const [filter, setFilter] = useState("all");
  const logs = AUDIT_LOGS.filter((l) => filter === "all" || l.severity === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Журнал аудита"
        description="События безопасности и действия пользователей."
      />

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: "Все" },
          { value: "info", label: "Информация" },
          { value: "warning", label: "Предупреждения" },
          { value: "error", label: "Ошибки" },
        ]}
      />

      <Card>
        <CardContent className="space-y-2 p-4">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border p-3.5">
              {severityBadge(log.severity)}
              <div className="min-w-0 flex-1">
                <div className="font-medium">{log.action}</div>
                <div className="text-sm text-muted-foreground">
                  {log.actor} → {log.target}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-muted-foreground">{formatRelative(log.at)}</div>
                <div className="text-[11px] text-muted-foreground/70">
                  {formatDate(log.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
