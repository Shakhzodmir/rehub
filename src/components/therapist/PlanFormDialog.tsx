import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useClinic } from "@/context/ClinicContext";
import { EXERCISE_LIST, getExercise } from "@/lib/exercises";
import type { ExerciseKey, PlanExercise, TreatmentPlan } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** edit this plan; omit to create a new one */
  plan?: TreatmentPlan;
  /** preselect the patient when creating from their page */
  patientId?: string;
}

interface Row {
  key: ExerciseKey;
  sets: string;
  reps: string;
  hold: string;
}

const EMPTY_ROW: Row = { key: "squats", sets: "3", reps: "12", hold: "" };

function toRows(exercises: PlanExercise[]): Row[] {
  return exercises.map((pe) => ({
    key: pe.key,
    sets: String(pe.targetSets),
    reps: String(pe.targetReps),
    hold: pe.holdSeconds ? String(pe.holdSeconds) : "",
  }));
}

export function PlanFormDialog({ open, onClose, plan, patientId }: Props) {
  const { patients, addPlan, updatePlan } = useClinic();
  const isEdit = Boolean(plan);

  const [patient, setPatient] = useState(plan?.patientId ?? patientId ?? patients[0]?.id ?? "");
  const [title, setTitle] = useState(plan?.title ?? "");
  const [diagnosis, setDiagnosis] = useState(plan?.diagnosis ?? "");
  const [icd, setIcd] = useState(plan?.icd ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(plan ? toRows(plan.exercises) : [{ ...EMPTY_ROW }]);
  const [error, setError] = useState<string | null>(null);

  // re-sync when opening for a different plan/patient
  useEffect(() => {
    if (!open) return;
    setPatient(plan?.patientId ?? patientId ?? patients[0]?.id ?? "");
    setTitle(plan?.title ?? "");
    setDiagnosis(plan?.diagnosis ?? "");
    setIcd(plan?.icd ?? "");
    setNotes(plan?.notes ?? "");
    setRows(plan ? toRows(plan.exercises) : [{ ...EMPTY_ROW }]);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan?.id, patientId]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) {
      setError("Выберите пациента");
      return;
    }
    if (title.trim().length < 3) {
      setError("Укажите название плана");
      return;
    }
    if (diagnosis.trim().length < 3) {
      setError("Укажите диагноз");
      return;
    }
    if (rows.length === 0) {
      setError("Добавьте хотя бы одно упражнение");
      return;
    }
    const exercises: PlanExercise[] = [];
    for (const r of rows) {
      const sets = Number(r.sets);
      const reps = Number(r.reps);
      const hold = r.hold === "" ? undefined : Number(r.hold);
      const isHold = getExercise(r.key).mode === "hold";
      if (!isHold && (!Number.isInteger(sets) || sets < 1 || !Number.isInteger(reps) || reps < 1)) {
        setError(`«${getExercise(r.key).name}»: подходы и повторы должны быть ≥ 1`);
        return;
      }
      if (hold !== undefined && (!Number.isInteger(hold) || hold < 1 || hold > 600)) {
        setError(`«${getExercise(r.key).name}»: удержание — целое число секунд (1–600)`);
        return;
      }
      exercises.push({
        key: r.key,
        targetSets: isHold ? 1 : sets,
        targetReps: isHold ? 1 : reps,
        holdSeconds: hold,
      });
    }

    if (isEdit && plan) {
      updatePlan(plan.id, {
        patientId: patient,
        title: title.trim(),
        diagnosis: diagnosis.trim(),
        icd: icd.trim(),
        notes: notes.trim() || undefined,
        exercises,
      });
      toast({ title: "План обновлён", description: title.trim(), variant: "success" });
    } else {
      addPlan({
        patientId: patient,
        title: title.trim(),
        diagnosis: diagnosis.trim(),
        icd: icd.trim(),
        notes: notes.trim() || undefined,
        status: "active",
        exercises,
      });
      toast({ title: "План создан", description: title.trim(), variant: "success" });
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Изменить план лечения" : "Новый план лечения"}
      description={
        isEdit
          ? "Изменения сразу появятся в кабинете пациента."
          : "План станет активной программой пациента."
      }
      className="max-h-[90dvh] max-w-2xl overflow-y-auto"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-patient">
              Пациент <span className="text-destructive">*</span>
            </Label>
            <Select
              id="pf-patient"
              value={patient}
              onChange={(e) => setPatient(e.target.value)}
              disabled={isEdit}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.age} лет
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-title">
              Название плана <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Восстановление колена · Фаза 1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-diag">
              Диагноз <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pf-diag"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Состояние после артроскопии"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-icd">Код МКБ</Label>
            <Input
              id="pf-icd"
              value={icd}
              onChange={(e) => setIcd(e.target.value)}
              placeholder="M23.2"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-notes">Заметки для пациента</Label>
          <Input
            id="pf-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Контроль боли ≤ 3/10"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Упражнения <span className="text-destructive">*</span>
          </legend>
          <div className="space-y-2">
            {rows.map((row, i) => {
              const isHold = getExercise(row.key).mode === "hold";
              return (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label htmlFor={`pf-ex-${i}`} className="text-xs text-muted-foreground">
                      Упражнение
                    </Label>
                    <Select
                      id={`pf-ex-${i}`}
                      value={row.key}
                      onChange={(e) => setRow(i, { key: e.target.value as ExerciseKey })}
                    >
                      {EXERCISE_LIST.map((ex) => (
                        <option key={ex.key} value={ex.key}>
                          {ex.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {!isHold && (
                    <>
                      <div className="w-20 space-y-1">
                        <Label htmlFor={`pf-sets-${i}`} className="text-xs text-muted-foreground">
                          Подходы
                        </Label>
                        <Input
                          id={`pf-sets-${i}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={row.sets}
                          onChange={(e) => setRow(i, { sets: e.target.value })}
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label htmlFor={`pf-reps-${i}`} className="text-xs text-muted-foreground">
                          Повторы
                        </Label>
                        <Input
                          id={`pf-reps-${i}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={row.reps}
                          onChange={(e) => setRow(i, { reps: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  <div className="w-28 space-y-1">
                    <Label htmlFor={`pf-hold-${i}`} className="text-xs text-muted-foreground">
                      {isHold ? "Цель, сек" : "Пауза, сек"}
                    </Label>
                    <Input
                      id={`pf-hold-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={600}
                      value={row.hold}
                      onChange={(e) => setRow(i, { hold: e.target.value })}
                      placeholder={isHold ? "30" : "—"}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Убрать ${getExercise(row.key).name}`}
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
          >
            <Plus className="h-4 w-4" /> Добавить упражнение
          </Button>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">{isEdit ? "Сохранить изменения" : "Создать план"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
