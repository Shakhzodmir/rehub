import { useEffect, useMemo, useRef, useState } from "react";
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
  Square,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getExercise } from "@/lib/exercises";
import { ACTIVE_PLAN } from "@/lib/mock-data";
import { usePoseTracker } from "@/hooks/usePoseTracker";
import type { ExerciseKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "ready" | "active" | "done";

export default function PatientSession() {
  const { key } = useParams<{ key: ExerciseKey }>();
  const navigate = useNavigate();
  const exercise = key ? getExercise(key) : undefined;

  const planItem = ACTIVE_PLAN.exercises.find((e) => e.key === key);
  const targetReps = planItem?.targetReps ?? 12;
  const targetSets = planItem?.targetSets ?? 3;

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [finalStats, setFinalStats] = useState({ reps: 0, good: 0, violations: 0, duration: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(0);

  const { status, error, stats } = usePoseTracker({
    exercise: exercise!,
    active: phase === "active" && !!exercise,
    videoRef,
    canvasRef,
  });

  // session timer
  useEffect(() => {
    if (phase !== "active") return;
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  const formScore = useMemo(
    () => (stats.reps > 0 ? Math.round((stats.goodReps / stats.reps) * 100) : 100),
    [stats.reps, stats.goodReps]
  );
  const repProgress = Math.min(100, (stats.reps / (targetReps * targetSets)) * 100);

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
    });
    setPhase("done");
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
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
                <Button size="lg" onClick={() => setPhase("active")}>
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
                {stats.positioning !== "good" && (
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
                {exercise.mode === "balance"
                  ? "Удерживайте равновесие, следуйте подсказкам"
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
                  <CardTitle className="text-base">Цель</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="font-heading text-5xl font-bold tabular-nums text-primary">
                      {stats.reps}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      из {targetReps * targetSets} повторений
                    </div>
                  </div>
                  <Progress value={repProgress} indicatorClassName="bg-accent" />
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <div className="text-xl font-bold tabular-nums">{targetReps}×{targetSets}</div>
                      <div className="text-xs text-muted-foreground">повт × подходы</div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className={cn("text-xl font-bold tabular-nums", formScore >= 85 ? "text-success" : "text-warning")}>
                        {formScore}%
                      </div>
                      <div className="text-xs text-muted-foreground">техника</div>
                    </div>
                  </div>
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
              targetReps={targetReps * targetSets}
              onRetry={() => {
                setElapsed(0);
                setPhase("ready");
              }}
              onSave={() => navigate("/patient/progress")}
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
  onRetry,
  onSave,
  mmss,
}: {
  exerciseName: string;
  stats: { reps: number; good: number; violations: number; duration: number };
  targetReps: number;
  onRetry: () => void;
  onSave: () => void;
  mmss: (s: number) => string;
}) {
  const formScore = stats.reps > 0 ? Math.round((stats.good / stats.reps) * 100) : 100;
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
          <Metric label="Повторений" value={`${stats.reps}/${targetReps}`} icon={Gauge} />
          <Metric label="Время" value={mmss(stats.duration)} icon={Timer} />
          <Metric label="Техника" value={`${formScore}%`} icon={CheckCircle2} tone="success" />
          <Metric
            label="Ошибки"
            value={String(stats.violations)}
            icon={TriangleAlert}
            tone={stats.violations > 2 ? "warning" : undefined}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" /> Ещё раз
          </Button>
          <Button className="flex-1" onClick={onSave}>
            <Save className="h-4 w-4" /> Сохранить
          </Button>
        </div>
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
