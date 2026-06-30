import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Gauge,
  Loader2,
  RotateCcw,
  Save,
  ScanLine,
  Square,
  Timer,
  TriangleAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { getExercise } from "@/lib/exercises";
import { ACTIVE_PLAN, CURRENT_PATIENT_ID } from "@/lib/mock-data";
import { usePoseTracker, type RepEvent } from "@/hooks/usePoseTracker";
import { useSessions } from "@/context/SessionsContext";
import type { ExerciseKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "ready" | "active" | "done";

interface FinalStats {
  reps: number;
  good: number;
  violations: number;
  duration: number;
  achievedROM: number;
  formScore: number;
}

export default function PatientSession() {
  const { key } = useParams<{ key: ExerciseKey }>();
  const navigate = useNavigate();
  const { addSession } = useSessions();
  const exercise = key ? getExercise(key) : undefined;

  const planItem = ACTIVE_PLAN.exercises.find((e) => e.key === key);
  const targetReps = planItem?.targetReps ?? 12;
  const targetSets = planItem?.targetSets ?? 3;
  const goal = targetReps * targetSets;
  const isBalance = exercise?.mode === "balance";

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null);
  const [live, setLive] = useState("");
  const [finalStats, setFinalStats] = useState<FinalStats>({
    reps: 0,
    good: 0,
    violations: 0,
    duration: 0,
    achievedROM: 0,
    formScore: 100,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(0);
  const feedbackTimer = useRef<number | undefined>(undefined);

  const onRep = useCallback((e: RepEvent) => {
    if (e.good) {
      setLive(`Повтор ${e.count}, хорошо`);
      setFeedback({ text: `Повтор ${e.count} — отлично`, good: true });
    } else {
      setLive(`Повтор ${e.count}. ${e.cue ?? "Поправьте технику"}`);
      setFeedback({ text: e.cue ?? "Поправьте технику", good: false });
    }
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 2600);
  }, []);

  const { status, error, stats } = usePoseTracker({
    exercise: exercise!,
    active: phase === "active" && !!exercise,
    videoRef,
    canvasRef,
    voice: voiceOn,
    onRep,
  });

  // session timer
  useEffect(() => {
    if (phase !== "active") return;
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  // calibration: cleared on entry, set the first time the patient is well-framed
  useEffect(() => {
    if (phase !== "active") {
      setCalibrated(false);
      return;
    }
    if (status === "ready" && stats.positioning === "good") setCalibrated(true);
  }, [phase, status, stats.positioning]);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  const formScore = useMemo(() => {
    if (isBalance) return stats.balanceScore;
    return stats.reps > 0 ? Math.round((stats.goodReps / stats.reps) * 100) : 100;
  }, [isBalance, stats.balanceScore, stats.reps, stats.goodReps]);
  const repProgress = Math.min(100, goal > 0 ? (stats.reps / goal) * 100 : 0);

  if (!exercise) {
    return (
      <div className="space-y-4">
        <p>Упражнение не найдено.</p>
        <Button asChild variant="outline">
          <Link to="/patient/exercises">
            <ArrowLeft className="h-4 w-4" /> К упражнениям
          </Link>
        </Button>
      </div>
    );
  }

  const stop = () => {
    setFinalStats({
      reps: stats.reps,
      good: stats.goodReps,
      violations: stats.violations,
      duration: elapsed,
      achievedROM: stats.achievedROM,
      formScore: isBalance ? stats.balanceScore : formScore,
    });
    setPhase("done");
  };

  const handleSave = (painLevel: number) => {
    addSession({
      patientId: CURRENT_PATIENT_ID,
      date: new Date().toISOString(),
      exercise: exercise.key,
      reps: finalStats.reps,
      targetReps: goal,
      durationSec: finalStats.duration,
      formScore: finalStats.formScore,
      violations: finalStats.violations,
      painLevel,
      achievedROM: finalStats.achievedROM || undefined,
    });
    toast({
      title: "Тренировка сохранена",
      description: `${exercise.name}: ${finalStats.reps} повт., техника ${finalStats.formScore}%, боль ${painLevel}/10`,
      variant: "success",
    });
    navigate("/patient/progress");
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Назад
        </Button>
        <Badge variant="outline">{exercise.focus}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Camera stage */}
        <Card className="overflow-hidden">
          <div className="relative aspect-video w-full bg-sidebar">
            {/* mirrored video + skeleton overlay */}
            <div className="absolute inset-0 [transform:scaleX(-1)]">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            </div>

            {/* ready overlay */}
            {phase === "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-sidebar/90 p-6 text-center text-white">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sidebar-accent/20 text-sidebar-accent">
                  <Camera className="h-8 w-8" />
                </span>
                <div>
                  <h3 className="font-heading text-xl font-bold">{exercise.name}</h3>
                  <p className="mt-1 max-w-sm text-sm text-sidebar-foreground">
                    Встаньте так, чтобы всё тело было в кадре. Анализ позы выполняется прямо в
                    браузере — видео никуда не отправляется.
                  </p>
                </div>
                <Button size="xl" onClick={() => setPhase("active")}>
                  <Camera className="h-4 w-4" /> Включить камеру
                </Button>
              </div>
            )}

            {/* loading / error overlay */}
            {phase === "active" && status !== "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sidebar/90 p-6 text-center text-white">
                {status === "error" ? (
                  <>
                    <AlertTriangle className="h-8 w-8 text-warning" />
                    <p className="max-w-sm text-sm text-sidebar-foreground">{error}</p>
                    <Button variant="outline" onClick={() => setPhase("ready")}>
                      <RotateCcw className="h-4 w-4" /> Повторить
                    </Button>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-sidebar-accent" />
                    <p className="text-sm text-sidebar-foreground">Загрузка модели ИИ и камеры…</p>
                  </>
                )}
              </div>
            )}

            {/* calibration gate — until the patient is first well-framed */}
            {phase === "active" && status === "ready" && !calibrated && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sidebar/75 p-6 text-center text-white">
                <ScanLine className="h-10 w-10 animate-pulse text-sidebar-accent" />
                <div>
                  <h3 className="font-heading text-lg font-bold">Калибровка</h3>
                  <p className="mt-1 max-w-xs text-sm text-sidebar-foreground">
                    Отойдите на 2–3 шага, чтобы всё тело попало в кадр. Отсчёт начнётся, как только
                    я вас увижу.
                  </p>
                </div>
              </div>
            )}

            {/* live HUD */}
            {phase === "active" && status === "ready" && (
              <>
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <Badge variant="destructive" className="gap-1.5 bg-destructive text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC
                  </Badge>
                  <Badge variant="secondary" className="bg-black/40 text-white">
                    <Timer className="h-3 w-3" /> {mmss(elapsed)}
                  </Badge>
                  <Badge variant="secondary" className="bg-black/40 text-white tabular-nums">
                    {stats.fps} FPS
                  </Badge>
                </div>

                <button
                  onClick={() => setVoiceOn((v) => !v)}
                  aria-label={voiceOn ? "Выключить голосовые подсказки" : "Включить голосовые подсказки"}
                  aria-pressed={voiceOn}
                  className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>

                {/* transient per-rep corrective feedback */}
                {calibrated && feedback && (
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-14 mx-auto w-fit rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg",
                      feedback.good ? "bg-success text-white" : "bg-warning text-[hsl(var(--warning-foreground))]"
                    )}
                  >
                    {feedback.good ? "✓ " : "⚠ "}
                    {feedback.text}
                  </div>
                )}

                {calibrated && stats.positioning !== "good" && (
                  <div className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-warning px-4 py-1.5 text-sm font-medium text-[hsl(var(--warning-foreground))]">
                    {stats.positioning === "no-pose"
                      ? "Не вижу вас — встаньте в кадр"
                      : "Плохая видимость суставов — отойдите дальше"}
                  </div>
                )}
              </>
            )}
          </div>

          {phase === "active" && status === "ready" && (
            <CardContent className="flex items-center justify-between p-4">
              <div className="text-sm text-muted-foreground">
                {isBalance
                  ? `Стабильность ${stats.balanceScore}% · удерживайте равновесие`
                  : `Стадия: ${stats.stage === "down" ? "вниз" : stats.stage === "up" ? "вверх" : "—"} · угол ${stats.angle}°`}
              </div>
              <Button variant="destructive" onClick={stop}>
                <Square className="h-4 w-4" /> Завершить
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Side panel */}
        <div className="space-y-5">
          {phase !== "done" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{isBalance ? "Баланс" : "Цель"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="font-heading text-5xl font-bold tabular-nums text-primary">
                      {isBalance ? `${stats.balanceScore}%` : stats.reps}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isBalance ? `стабильность · ${mmss(elapsed)}` : `из ${goal} повторений`}
                    </div>
                  </div>
                  {!isBalance && <Progress value={repProgress} indicatorClassName="bg-accent" label="Прогресс повторов" />}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <div className="text-xl font-bold tabular-nums">
                        {isBalance ? mmss(elapsed) : `${targetReps}×${targetSets}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isBalance ? "время" : "повт × подходы"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className={cn("text-xl font-bold tabular-nums", formScore >= 85 ? "text-success" : "text-warning")}>
                        {formScore}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isBalance ? "стабильность" : "техника"}
                      </div>
                    </div>
                  </div>
                  {!isBalance && stats.achievedROM > 0 && (
                    <div className="rounded-lg border border-border p-3 text-center">
                      <div className="text-xl font-bold tabular-nums text-primary">{stats.achievedROM}°</div>
                      <div className="text-xs text-muted-foreground">амплитуда (ROM)</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Подсказки по технике</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {exercise.cues.map((cue, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="text-muted-foreground">{cue}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <SummaryCard
              exerciseName={exercise.name}
              stats={finalStats}
              targetReps={goal}
              isBalance={isBalance}
              onRetry={() => {
                setElapsed(0);
                setPhase("ready");
              }}
              onSave={handleSave}
              mmss={mmss}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  exerciseName,
  stats,
  targetReps,
  isBalance,
  onRetry,
  onSave,
  mmss,
}: {
  exerciseName: string;
  stats: FinalStats;
  targetReps: number;
  isBalance: boolean;
  onRetry: () => void;
  onSave: (painLevel: number) => void;
  mmss: (s: number) => string;
}) {
  const [pain, setPain] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <CardTitle>Тренировка завершена</CardTitle>
        <p className="text-sm text-muted-foreground">{exerciseName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label={isBalance ? "Время" : "Повторений"}
            value={isBalance ? mmss(stats.duration) : `${stats.reps}/${targetReps}`}
            icon={Gauge}
          />
          <Metric label="Время" value={mmss(stats.duration)} icon={Timer} />
          <Metric
            label={isBalance ? "Стабильность" : "Техника"}
            value={`${stats.formScore}%`}
            icon={CheckCircle2}
            tone="success"
          />
          {isBalance ? (
            <Metric label="Амплитуда" value={stats.achievedROM ? `${stats.achievedROM}°` : "—"} icon={Gauge} />
          ) : (
            <Metric
              label="Ошибки"
              value={String(stats.violations)}
              icon={TriangleAlert}
              tone={stats.violations > 2 ? "warning" : undefined}
            />
          )}
        </div>

        {/* mandatory pain capture (NPRS 0-10) */}
        <fieldset>
          <legend className="text-sm font-medium">Боль во время упражнения?</legend>
          <p className="mb-2 text-xs text-muted-foreground">0 — нет боли, 10 — сильнейшая</p>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                aria-label={`Боль ${n} из 10`}
                aria-pressed={pain === n}
                onClick={() => setPain(n)}
                className={cn(
                  "flex h-10 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  pain === n
                    ? n <= 3
                      ? "bg-success text-white"
                      : n <= 6
                        ? "bg-warning text-[hsl(var(--warning-foreground))]"
                        : "bg-destructive text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" /> Ещё раз
          </Button>
          <Button
            className="flex-1"
            disabled={pain === null}
            onClick={() => pain !== null && onSave(pain)}
          >
            <Save className="h-4 w-4" /> Сохранить
          </Button>
        </div>
        {pain === null && (
          <p className="text-center text-xs text-muted-foreground">
            Укажите уровень боли, чтобы сохранить тренировку
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <Icon
        className={cn(
          "h-4 w-4",
          tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-muted-foreground"
        )}
      />
      <div className="mt-1.5 text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
