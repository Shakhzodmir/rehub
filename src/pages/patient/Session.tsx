import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  RotateCcw,
  Save,
  Scale,
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
import { CURRENT_PATIENT_ID } from "@/lib/mock-data";
import { usePoseTracker, type RepEvent } from "@/hooks/usePoseTracker";
import { useClinic } from "@/context/ClinicContext";
import { useSessions } from "@/context/SessionsContext";
import type { ExerciseKey, RepRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "ready" | "active" | "done";

interface FinalStats {
  reps: number;
  good: number;
  violations: number;
  duration: number;
  achievedROM: number;
  formScore: number;
  avgRepSec: number | null;
  symmetry: number | null;
  holdSec: number;
  repHistory: RepRecord[];
}

const EMPTY_FINAL: FinalStats = {
  reps: 0,
  good: 0,
  violations: 0,
  duration: 0,
  achievedROM: 0,
  formScore: 100,
  avgRepSec: null,
  symmetry: null,
  holdSec: 0,
  repHistory: [],
};

export default function PatientSession() {
  const { key } = useParams<{ key: ExerciseKey }>();
  const navigate = useNavigate();
  const { addSession } = useSessions();
  const { planFor } = useClinic();
  const exercise = key ? getExercise(key) : undefined;

  const planItem = planFor(CURRENT_PATIENT_ID)?.exercises.find((e) => e.key === key);
  const targetReps = planItem?.targetReps ?? 12;
  const targetSets = planItem?.targetSets ?? 3;
  const goal = targetReps * targetSets;
  const isBalance = exercise?.mode === "balance";
  const isHold = exercise?.mode === "hold";
  const holdTarget = planItem?.holdSeconds ?? exercise?.holdTargetSec ?? 30;

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  // voice coaching is on by default; the choice persists across sessions
  const [voiceOn, setVoiceOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem("posetrack.voice") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("posetrack.voice", voiceOn ? "1" : "0");
    } catch {
      /* private mode — non-fatal */
    }
  }, [voiceOn]);
  const [calibrated, setCalibrated] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null);
  const [live, setLive] = useState("");
  const [repHistory, setRepHistory] = useState<RepRecord[]>([]);
  const [finalStats, setFinalStats] = useState<FinalStats>(EMPTY_FINAL);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const feedbackTimer = useRef<number | undefined>(undefined);

  // fullscreen stage (native API where available, CSS fallback otherwise)
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen();
    } else {
      setIsFullscreen((v) => !v); // iOS Safari: pseudo-fullscreen via CSS
    }
  };

  const onRep = useCallback((e: RepEvent) => {
    if (e.good) {
      setLive(`Повтор ${e.count}, хорошо`);
      setFeedback({ text: `Повтор ${e.count} — отлично`, good: true });
    } else {
      setLive(`Повтор ${e.count}. ${e.cue ?? "Поправьте технику"}`);
      setFeedback({ text: e.cue ?? "Поправьте технику", good: false });
    }
    setRepHistory((prev) => [
      ...prev,
      {
        good: e.good,
        peakAngle: e.peakAngle,
        durationSec: e.durationMs != null ? Math.round(e.durationMs / 100) / 10 : undefined,
      },
    ]);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 2600);
  }, []);

  const { status, error, stats } = usePoseTracker({
    exercise: exercise!,
    active: phase === "active" && !!exercise,
    videoRef,
    canvasRef,
    voice: voiceOn,
    holdSeconds: planItem?.holdSeconds,
    onRep,
  });

  // session timer
  useEffect(() => {
    if (phase !== "active") return;
    startRef.current = Date.now();
    setRepHistory([]);
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

  // announce tracking loss to screen readers, debounced so flicker stays quiet
  useEffect(() => {
    if (phase !== "active" || !calibrated || stats.positioning === "good") return;
    const id = window.setTimeout(
      () =>
        setLive(
          stats.positioning === "no-pose"
            ? "Вы вышли из кадра — встаньте перед камерой"
            : "Плохая видимость суставов — отойдите дальше"
        ),
      1500
    );
    return () => window.clearTimeout(id);
  }, [phase, calibrated, stats.positioning]);

  const holdSec = Math.floor(stats.holdMs / 1000);

  const formScore = useMemo(() => {
    if (isBalance) return stats.balanceScore;
    if (isHold) {
      // efficiency: share of tracked time actually spent in the correct position
      return stats.trackedMs > 2000 ? Math.round((stats.holdMs / stats.trackedMs) * 100) : 100;
    }
    return stats.reps > 0 ? Math.round((stats.goodReps / stats.reps) * 100) : 100;
  }, [isBalance, isHold, stats.balanceScore, stats.trackedMs, stats.holdMs, stats.reps, stats.goodReps]);

  const repProgress = Math.min(100, goal > 0 ? (stats.reps / goal) * 100 : 0);
  const holdProgress = Math.min(100, holdTarget > 0 ? (holdSec / holdTarget) * 100 : 0);

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
    if (document.fullscreenElement) void document.exitFullscreen();
    setIsFullscreen(false);
    setFinalStats({
      reps: stats.reps,
      good: stats.goodReps,
      violations: stats.violations,
      duration: elapsed,
      achievedROM: stats.achievedROM,
      formScore,
      avgRepSec: stats.avgRepMs != null ? Math.round(stats.avgRepMs / 100) / 10 : null,
      symmetry: stats.symmetry,
      holdSec,
      repHistory,
    });
    setPhase("done");
  };

  const handleSave = (painLevel: number) => {
    addSession({
      patientId: CURRENT_PATIENT_ID,
      date: new Date().toISOString(),
      exercise: exercise.key,
      // hold mode maps to one done/failed "rep" so adherence ratios stay meaningful
      reps: isHold ? (finalStats.holdSec >= holdTarget ? 1 : 0) : finalStats.reps,
      targetReps: isHold ? 1 : goal,
      durationSec: finalStats.duration,
      formScore: finalStats.formScore,
      violations: finalStats.violations,
      painLevel,
      achievedROM: finalStats.achievedROM || undefined,
      avgRepSec: finalStats.avgRepSec ?? undefined,
      symmetry: finalStats.symmetry ?? undefined,
      holdSec: isHold ? finalStats.holdSec : undefined,
      repHistory: finalStats.repHistory.length ? finalStats.repHistory : undefined,
    });
    toast({
      title: "Тренировка сохранена",
      description: isHold
        ? `${exercise.name}: удержание ${finalStats.holdSec} с, боль ${painLevel}/10`
        : `${exercise.name}: ${finalStats.reps} повт., техника ${finalStats.formScore}%, боль ${painLevel}/10`,
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
          <div
            ref={stageRef}
            className={cn(
              "relative w-full bg-sidebar",
              isFullscreen ? "fixed inset-0 z-50 h-full" : "aspect-video"
            )}
          >
            {/* the video is mirrored; the canvas is NOT — the overlay mirrors
                points in code so angle labels stay readable. Both use
                object-cover so the skeleton lands exactly on the body even
                when the camera delivers a non-16:9 stream. */}
            <div className="absolute inset-0 [transform:scaleX(-1)]">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            </div>
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

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
                <Button
                  size="xl"
                  onClick={() => {
                    // unlock speech synthesis inside the user gesture —
                    // mobile browsers refuse TTS started outside one
                    try {
                      const synth = window.speechSynthesis;
                      if (synth) {
                        synth.resume();
                        const u = new SpeechSynthesisUtterance(" ");
                        u.volume = 0;
                        synth.speak(u);
                      }
                    } catch {
                      /* speech unsupported — visual feedback still works */
                    }
                    setPhase("active");
                  }}
                >
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
                <ScanLine className="h-10 w-10 animate-pulse text-sidebar-accent motion-reduce:animate-none" />
                <div>
                  <h3 className="font-heading text-lg font-bold">Калибровка</h3>
                  <p className="mt-1 max-w-xs text-sm text-sidebar-foreground">
                    Отойдите на 2–3 шага, чтобы всё тело попало в кадр. Отсчёт начнётся, как только
                    я вас увижу.
                  </p>
                </div>
              </div>
            )}

            {/* live HUD — deliberately minimal: timer, controls, and warnings only */}
            {phase === "active" && status === "ready" && (
              <>
                <div className="absolute left-3 top-3 flex select-none items-center gap-2">
                  <Badge variant="secondary" className="bg-black/55 tabular-nums text-white">
                    <Timer className="h-3 w-3" /> {mmss(elapsed)}
                  </Badge>
                  {/* performance warning appears only when tracking degrades */}
                  {stats.fps > 0 && stats.fps < 20 && (
                    <Badge variant="secondary" className="bg-black/55 tabular-nums text-warning">
                      {stats.fps} FPS{stats.delegate === "CPU" ? " · CPU" : ""}
                    </Badge>
                  )}
                </div>

                <div className="absolute right-3 top-3 flex items-center gap-2">
                  <button
                    onClick={() => setVoiceOn((v) => !v)}
                    aria-label={voiceOn ? "Выключить голосовые подсказки" : "Включить голосовые подсказки"}
                    aria-pressed={voiceOn}
                    className="inline-flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95 motion-reduce:transition-none"
                  >
                    {voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "На весь экран"}
                    className="inline-flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95 motion-reduce:transition-none"
                  >
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </button>
                </div>

                {/* fullscreen: the side panel is hidden, so surface the count here */}
                {isFullscreen && calibrated && (
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                    <div className="text-white drop-shadow">
                      <div className="font-heading text-6xl font-bold tabular-nums">
                        {isBalance ? `${stats.balanceScore}%` : isHold ? mmss(holdSec) : stats.reps}
                      </div>
                      <div className="text-sm text-white/85">
                        {isBalance
                          ? "стабильность"
                          : isHold
                            ? `из ${mmss(holdTarget)} удержания`
                            : `из ${goal} повторений · техника ${formScore}%`}
                      </div>
                    </div>
                    <Button variant="destructive" onClick={stop}>
                      <Square className="h-4 w-4" /> Завершить
                    </Button>
                  </div>
                )}

                {/* live depth gauge — fill the bar to the top for a clean rep */}
                {calibrated && !isBalance && !isHold && stats.positioning === "good" && (
                  <DepthGauge pct={stats.depthPct} />
                )}

                {/* transient per-rep corrective feedback */}
                {calibrated && feedback && (
                  <div
                    className={cn(
                      "absolute inset-x-0 mx-auto w-fit rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg",
                      isFullscreen ? "bottom-36" : "bottom-14",
                      feedback.good ? "bg-success text-white" : "bg-warning text-[hsl(var(--warning-foreground))]"
                    )}
                  >
                    {feedback.good ? "✓ " : "⚠ "}
                    {feedback.text}
                  </div>
                )}

                {calibrated && stats.positioning !== "good" && (
                  <div
                    className={cn(
                      "absolute inset-x-0 mx-auto w-fit rounded-full bg-warning px-4 py-1.5 text-sm font-medium text-[hsl(var(--warning-foreground))]",
                      isFullscreen ? "bottom-28" : "bottom-3"
                    )}
                  >
                    {stats.positioning === "no-pose"
                      ? "Не вижу вас — встаньте в кадр"
                      : "Плохая видимость суставов — отойдите дальше"}
                  </div>
                )}

                {calibrated && stats.positioning === "good" && stats.viewHint && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "absolute inset-x-0 mx-auto flex w-fit items-center gap-2 rounded-full bg-warning px-4 py-1.5 text-sm font-medium text-[hsl(var(--warning-foreground))] shadow-lg",
                      isFullscreen ? "top-6" : "top-3"
                    )}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {stats.viewHint} — так измерение точнее
                  </div>
                )}
              </>
            )}
          </div>

          {phase === "active" && status === "ready" && (
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {isBalance
                    ? `Стабильность ${stats.balanceScore}% · удерживайте равновесие`
                    : isHold
                      ? `Удержание ${mmss(holdSec)} из ${mmss(holdTarget)} · ${stats.holding ? "в позиции ✓" : "займите позицию"}`
                      : `Стадия: ${stats.stage === "down" ? "вниз" : stats.stage === "up" ? "вверх" : "—"} · угол ${stats.viewOk ? "" : "~"}${stats.angle}°` +
                        (stats.avgRepMs != null ? ` · темп ${(stats.avgRepMs / 1000).toFixed(1)} с` : "") +
                        (stats.symmetry != null ? ` · симметрия ${stats.symmetry}%` : "")}
                </div>
                <Button variant="destructive" onClick={stop}>
                  <Square className="h-4 w-4" /> Завершить
                </Button>
              </div>
              {!isBalance && !isHold && repHistory.length > 0 && <RepStrip history={repHistory} />}
            </CardContent>
          )}
        </Card>

        {/* Side panel */}
        <div className="space-y-5">
          {phase !== "done" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {isBalance ? "Баланс" : isHold ? "Удержание" : "Цель"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="font-heading text-5xl font-bold tabular-nums text-primary">
                      {isBalance ? `${stats.balanceScore}%` : isHold ? mmss(holdSec) : stats.reps}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isBalance
                        ? `стабильность · ${mmss(elapsed)}`
                        : isHold
                          ? `из ${mmss(holdTarget)} удержания`
                          : `из ${goal} повторений`}
                    </div>
                  </div>
                  {!isBalance && (
                    <Progress
                      value={isHold ? holdProgress : repProgress}
                      indicatorClassName={isHold && holdProgress >= 100 ? "bg-success" : "bg-accent"}
                      label={isHold ? "Прогресс удержания" : "Прогресс повторов"}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <div className="text-xl font-bold tabular-nums">
                        {isBalance ? mmss(elapsed) : isHold ? `${holdTarget} с` : `${targetReps}×${targetSets}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isBalance ? "время" : isHold ? "цель" : "повт × подходы"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className={cn("text-xl font-bold tabular-nums", formScore >= 85 ? "text-success" : "text-warning")}>
                        {formScore}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isBalance ? "стабильность" : isHold ? "эффективность" : "техника"}
                      </div>
                    </div>
                  </div>
                  {!isBalance && !isHold && stats.achievedROM > 0 && (
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
              isHold={isHold}
              holdTarget={holdTarget}
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

/** Vertical live gauge: how deep the current movement is vs the clean-rep target. */
function DepthGauge({ pct }: { pct: number }) {
  return (
    <div
      aria-hidden
      className="absolute right-3 top-1/2 h-2/3 w-3 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 backdrop-blur"
    >
      <div
        className={cn(
          "absolute bottom-0 w-full rounded-full transition-[height] duration-100 ease-linear motion-reduce:transition-none",
          pct >= 100 ? "bg-success" : "bg-warning"
        )}
        style={{ height: `${Math.min(100, Math.max(0, pct))}%` }}
      />
      <div className="absolute top-0 h-0.5 w-full bg-white/80" />
    </div>
  );
}

/** Per-rep quality strip: green = clean, amber = needs correction. */
function RepStrip({ history }: { history: RepRecord[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="Качество повторов по порядку">
      {history.map((r, i) => (
        <span
          key={i}
          title={`Повтор ${i + 1}: ${r.peakAngle}°${r.durationSec != null ? `, ${r.durationSec.toFixed(1)} с` : ""}`}
          className={cn("h-2 w-5 rounded-full", r.good ? "bg-success" : "bg-warning")}
        />
      ))}
    </div>
  );
}

function SummaryCard({
  exerciseName,
  stats,
  targetReps,
  isBalance,
  isHold,
  holdTarget,
  onRetry,
  onSave,
  mmss,
}: {
  exerciseName: string;
  stats: FinalStats;
  targetReps: number;
  isBalance: boolean;
  isHold: boolean;
  holdTarget: number;
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
            label={isBalance ? "Время" : isHold ? "Удержание" : "Повторений"}
            value={isBalance ? mmss(stats.duration) : isHold ? `${mmss(stats.holdSec)}/${mmss(holdTarget)}` : `${stats.reps}/${targetReps}`}
            icon={Gauge}
          />
          <Metric label="Время" value={mmss(stats.duration)} icon={Timer} />
          <Metric
            label={isBalance ? "Стабильность" : isHold ? "Эффективность" : "Техника"}
            value={`${stats.formScore}%`}
            icon={CheckCircle2}
            tone="success"
          />
          {isBalance || isHold ? (
            <Metric label="Амплитуда" value={stats.achievedROM ? `${stats.achievedROM}°` : "—"} icon={Gauge} />
          ) : (
            <Metric
              label="Ошибки"
              value={String(stats.violations)}
              icon={TriangleAlert}
              tone={stats.violations > 2 ? "warning" : undefined}
            />
          )}
          {!isBalance && !isHold && stats.avgRepSec != null && (
            <Metric label="Темп повтора" value={`${stats.avgRepSec.toFixed(1)} с`} icon={Timer} />
          )}
          {stats.symmetry != null && (
            <Metric
              label="Симметрия"
              value={`${stats.symmetry}%`}
              icon={Scale}
              tone={stats.symmetry >= 85 ? "success" : "warning"}
            />
          )}
        </div>

        {!isBalance && !isHold && stats.repHistory.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Повторы по порядку</p>
            <RepStrip history={stats.repHistory} />
          </div>
        )}

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
                  "flex h-11 cursor-pointer touch-manipulation items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
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
