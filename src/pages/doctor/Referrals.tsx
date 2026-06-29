import { useState } from "react";
import { Plus, Send, X } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { REFERRALS, USERS } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import type { Referral } from "@/lib/types";
import { referralBadge } from "./referral-status";

export default function DoctorReferrals() {
  const [referrals, setReferrals] = useState<Referral[]>(REFERRALS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patientName: "", diagnosis: "", icd: "", priority: "обычный" as Referral["priority"] });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim()) return;
    setReferrals((r) => [
      {
        id: `r-${Date.now()}`,
        doctorName: USERS.doctor.name,
        status: "pending",
        date: new Date().toISOString(),
        ...form,
      },
      ...r,
    ]);
    setForm({ patientName: "", diagnosis: "", icd: "", priority: "обычный" });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Направления"
        description="Создавайте направления на дистанционную реабилитацию и следите за статусом."
        actions={
          <Button onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {open ? "Отмена" : "Новое направление"}
          </Button>
        }
      />

      {open && (
        <Card className="animate-fade-in border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Новое направление</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pname">Пациент</Label>
                <Input id="pname" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} placeholder="ФИО пациента" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="icd">Код МКБ</Label>
                <Input id="icd" value={form.icd} onChange={(e) => setForm({ ...form, icd: e.target.value })} placeholder="напр. M23.2" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dx">Диагноз</Label>
                <Textarea id="dx" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Описание состояния и цели реабилитации" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prio">Приоритет</Label>
                <select
                  id="prio"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Referral["priority"] })}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="обычный">обычный</option>
                  <option value="срочный">срочный</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto">
                  <Send className="h-4 w-4" /> Отправить терапевту
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <THead>
              <TR>
                <TH>Пациент</TH>
                <TH>Диагноз</TH>
                <TH>МКБ</TH>
                <TH>Приоритет</TH>
                <TH>Дата</TH>
                <TH>Статус</TH>
              </TR>
            </THead>
            <TBody>
              {referrals.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.patientName}</TD>
                  <TD className="max-w-[260px] text-sm text-muted-foreground">{r.diagnosis || "—"}</TD>
                  <TD><Badge variant="outline">{r.icd || "—"}</Badge></TD>
                  <TD>
                    <Badge variant={r.priority === "срочный" ? "destructive" : "secondary"}>{r.priority}</Badge>
                  </TD>
                  <TD className="text-sm text-muted-foreground">{formatDate(r.date, { day: "numeric", month: "short" })}</TD>
                  <TD>{referralBadge(r.status)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
