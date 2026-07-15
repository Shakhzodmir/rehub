import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useClinic } from "@/context/ClinicContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddPatientDialog({ open, onClose }: Props) {
  const { addPatient } = useClinic();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [condition, setCondition] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setAge("");
    setCondition("");
    setEmail("");
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ageNum = Number(age);
    if (name.trim().length < 2) {
      setError("Укажите имя пациента");
      return;
    }
    if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) {
      setError("Возраст должен быть от 1 до 120 лет");
      return;
    }
    if (condition.trim().length < 3) {
      setError("Опишите состояние / диагноз");
      return;
    }
    const patient = addPatient({
      name: name.trim(),
      age: ageNum,
      condition: condition.trim(),
      email: email.trim() || undefined,
    });
    toast({
      title: "Пациент добавлен",
      description: `${patient.name} появился в вашем списке.`,
      variant: "success",
    });
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Новый пациент"
      description="Добавьте пациента, чтобы назначить ему план лечения."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="np-name">
            Имя и фамилия <span className="text-destructive">*</span>
          </Label>
          <Input
            id="np-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иван Иванов"
            autoComplete="name"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-age">
              Возраст <span className="text-destructive">*</span>
            </Label>
            <Input
              id="np-age"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="45"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <Input
              id="np-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@mail.ru"
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-cond">
            Состояние / диагноз <span className="text-destructive">*</span>
          </Label>
          <Input
            id="np-cond"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Реабилитация после артроскопии колена"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">Добавить пациента</Button>
        </div>
      </form>
    </Dialog>
  );
}
