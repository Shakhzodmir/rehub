import { useMemo, useState } from "react";
import { Search, UserCog } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PLATFORM_USERS } from "@/lib/mock-data";
import { demoAction } from "@/lib/demo";
import { formatDate } from "@/lib/utils";

const statusVariant = (s: string) =>
  s === "Активен" ? "success" : s === "На проверке" ? "warning" : "destructive";

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");

  const filtered = useMemo(
    () =>
      PLATFORM_USERS.filter((u) => {
        const mq = u.name.toLowerCase().includes(q.toLowerCase()) || u.email.includes(q.toLowerCase());
        const mr = role === "all" || u.role === role;
        return mq && mr;
      }),
    [q, role]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Пользователи" description="Управление учётными записями платформы." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск пользователя" className="pl-9" aria-label="Поиск" />
        </div>
        <Tabs
          value={role}
          onChange={setRole}
          tabs={[
            { value: "all", label: "Все" },
            { value: "Пациент", label: "Пациенты" },
            { value: "Терапевт", label: "Терапевты" },
            { value: "Врач", label: "Врачи" },
          ]}
        />
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <THead>
              <TR>
                <TH>Пользователь</TH>
                <TH>Роль</TH>
                <TH>Статус</TH>
                <TH>Регистрация</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} className="h-9 w-9" />
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </TD>
                  <TD><Badge variant="outline">{u.role}</Badge></TD>
                  <TD><Badge variant={statusVariant(u.status)}>{u.status}</Badge></TD>
                  <TD className="text-sm text-muted-foreground">{formatDate(u.joined, { day: "numeric", month: "short", year: "numeric" })}</TD>
                  <TD>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Управление ${u.name}`}
                      onClick={() => demoAction("Управление пользователем")}
                    >
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TD>
                </TR>
              ))}
              {filtered.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
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
