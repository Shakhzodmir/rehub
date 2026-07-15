import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AddPatientDialog } from "@/components/therapist/AddPatientDialog";
import { useClinic } from "@/context/ClinicContext";
import { formatRelative } from "@/lib/utils";
import { statusBadge } from "./status";

export default function TherapistPatients() {
  const { patients } = useClinic();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(
    () =>
      patients.filter((p) => {
        const matchesQ =
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.condition.toLowerCase().includes(q.toLowerCase());
        const matchesF = filter === "all" || p.status === filter;
        return matchesQ && matchesF;
      }),
    [patients, q, filter]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Пациенты"
        description="Все пациенты под вашим наблюдением."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Добавить пациента
          </Button>
        }
      />
      <AddPatientDialog open={adding} onClose={() => setAdding(false)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени или диагнозу"
            className="pl-9"
            aria-label="Поиск пациентов"
          />
        </div>
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "all", label: "Все" },
            { value: "active", label: "Активные" },
            { value: "at-risk", label: "Под угрозой" },
            { value: "discharged", label: "Выписаны" },
          ]}
        />
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <THead>
              <TR>
                <TH>Пациент</TH>
                <TH>Состояние</TH>
                <TH>Статус</TH>
                <TH>Приверженность</TH>
                <TH>Восстановление</TH>
                <TH>Активность</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((p) => (
                <TR key={p.id} className="cursor-pointer">
                  <TD>
                    <Link to={`/therapist/patients/${p.id}`} className="flex items-center gap-3">
                      <Avatar name={p.name} className="h-9 w-9" />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.age} лет</div>
                      </div>
                    </Link>
                  </TD>
                  <TD className="max-w-[220px] text-sm text-muted-foreground">{p.condition}</TD>
                  <TD>{statusBadge(p.status)}</TD>
                  <TD>
                    <div className="flex w-28 items-center gap-2">
                      <Progress value={p.adherence} indicatorClassName={p.adherence < 50 ? "bg-destructive" : "bg-accent"} />
                      <span className="text-xs tabular-nums text-muted-foreground">{p.adherence}%</span>
                    </div>
                  </TD>
                  <TD className="tabular-nums">{p.recoveryProgress}%</TD>
                  <TD className="text-sm text-muted-foreground">{formatRelative(p.lastActive)}</TD>
                  <TD>
                    <Link to={`/therapist/patients/${p.id}`} aria-label={`Открыть ${p.name}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </TD>
                </TR>
              ))}
              {filtered.length === 0 && (
                <TR>
                  <TD colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Ничего не найдено
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
