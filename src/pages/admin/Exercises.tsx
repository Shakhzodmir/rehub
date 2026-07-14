import { Activity, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EXERCISE_LIST } from "@/lib/exercises";
import { demoAction } from "@/lib/demo";

const diffVariant = {
  "Лёгкое": "success",
  "Среднее": "warning",
  "Высокое": "destructive",
} as const;

export default function AdminExercises() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Библиотека упражнений"
        description="Каталог упражнений и параметры детекции для компьютерного зрения."
        actions={
          <Button onClick={() => demoAction("Добавление упражнения")}>
            <Plus className="h-4 w-4" /> Добавить упражнение
          </Button>
        }
      />

      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <THead>
              <TR>
                <TH>Упражнение</TH>
                <TH>Фокус</TH>
                <TH>Сложность</TH>
                <TH>Режим</TH>
                <TH>Сустав (углы)</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {EXERCISE_LIST.map((ex) => (
                <TR key={ex.key}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Activity className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-medium">{ex.name}</div>
                        <div className="text-xs text-muted-foreground">{ex.key}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-sm text-muted-foreground">{ex.focus}</TD>
                  <TD>
                    <Badge variant={diffVariant[ex.difficulty]}>{ex.difficulty}</Badge>
                  </TD>
                  <TD>
                    <Badge variant={ex.mode === "rep" ? "default" : "secondary"}>
                      {ex.mode === "rep" ? "повторения" : ex.mode === "hold" ? "удержание" : "баланс"}
                    </Badge>
                  </TD>
                  <TD className="text-sm tabular-nums text-muted-foreground">
                    {ex.mode === "balance"
                      ? "—"
                      : `[${ex.joint.join(", ")}] · ${ex.downAngle}°–${ex.upAngle}°`}
                  </TD>
                  <TD>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Изменить ${ex.name}`}
                      onClick={() => demoAction("Редактирование упражнения")}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
