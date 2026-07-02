import { useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { ExerciseDef } from "@/lib/types";
import {
  ExerciseEngine,
  type EngineSnapshot,
  type Positioning,
  type Stage,
} from "@/lib/pose/engine";
import { LandmarkSmoother } from "@/lib/pose/oneEuro";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// don't repeat the same spoken cue more often than this
const SPEAK_COOLDOWN_MS = 1500;
// UI re-renders are capped at this rate; rep/stage/positioning changes bypass the cap
const STATS_PUSH_MS = 100;
// this many consecutive detectForVideo failures triggers one CPU re-init …
const REINIT_ERR_STREAK = 5;
// … and this many gives up with a visible error
const FATAL_ERR_STREAK = 60;

export type { Stage, Positioning };

export interface RepEvent {
  good: boolean;
  cue: string | null;
  count: number;
  /** effort-extreme angle of the rep, degrees */
  peakAngle: number;
  /** effort start → completion, ms */
  durationMs: number | null;
}

export type Delegate = "GPU" | "CPU";

export interface PoseStats extends EngineSnapshot {
  /** smoothed frames-per-second of the analysis loop */
  fps: number;
  /** smoothed pose-inference latency, ms */
  inferenceMs: number;
  /** which compute delegate is running — surfaces GPU fallbacks for remote diagnosis */
  delegate: Delegate;
}

interface Options {
  exercise: ExerciseDef;
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Russian voice guidance via the Web Speech API */
  voice?: boolean;
  /** rep mode: required pause at the effort extreme (from the treatment plan) */
  holdSeconds?: number;
  onRep?: (e: RepEvent) => void;
}

const INITIAL: PoseStats = {
  reps: 0,
  goodReps: 0,
  violations: 0,
  stage: "unknown",
  angle: 0,
  positioning: "no-pose",
  balanceScore: 100,
  achievedROM: 0,
  side: "right",
  activeJoints: [0, 0, 0],
  symmetry: null,
  lastRepMs: null,
  avgRepMs: null,
  holdMs: 0,
  holding: false,
  trackedMs: 0,
  depthPct: 0,
  fps: 0,
  inferenceMs: 0,
  delegate: "GPU",
};

const ZONE_DEEP = "#10B981"; // effort target reached
const ZONE_ACTIVE = "#22D3EE"; // moving toward the target
const ZONE_HOLD_OFF = "#F59E0B"; // hold mode, out of the zone

export function usePoseTracker({
  exercise,
  active,
  videoRef,
  canvasRef,
  voice = false,
  holdSeconds,
  onRep,
}: Options) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PoseStats>(INITIAL);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawRef = useRef<DrawingUtils | null>(null);
  const lastVideoTimeRef = useRef(-1);

  // voice (kept in a ref so toggling it never restarts the camera/model)
  const voiceRef = useRef(voice);
  const lastSpeakRef = useRef(0);
  useEffect(() => {
    voiceRef.current = voice;
    if (!voice && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [voice]);

  const onRepRef = useRef(onRep);
  useEffect(() => {
    onRepRef.current = onRep;
  }, [onRep]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stopped = false; // loop halted on purpose (fatal error)

    const engine = new ExerciseEngine(exercise, { holdSeconds });
    const smoother = new LandmarkSmoother();
    let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
    let delegate: Delegate = "GPU";

    // timing / telemetry
    let lastDetectTs = 0;
    let dtEma: number | null = null;
    let detEma: number | null = null;
    let lastFrameTs = performance.now();

    // failure handling
    let errStreak = 0;
    let reinitStarted = false;
    let reinitInFlight = false;

    // render throttling
    let lastPushTs = 0;
    let lastPushed = { reps: -1, stage: "", positioning: "", holding: false };

    function speak(text: string, force = false) {
      if (!voiceRef.current || typeof window === "undefined") return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      const now = performance.now();
      if (!force && now - lastSpeakRef.current < SPEAK_COOLDOWN_MS) return;
      lastSpeakRef.current = now;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ru-RU";
      u.rate = 1.05;
      synth.speak(u);
    }

    function createLandmarker(d: Delegate) {
      return PoseLandmarker.createFromOptions(vision!, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: d },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputSegmentationMasks: false,
      });
    }

    async function setup() {
      try {
        setStatus("loading");
        setError(null);
        setStats(INITIAL);

        vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        if (cancelled) return;
        // some devices lose or lack a usable GPU context — fall back to CPU
        try {
          landmarkerRef.current = await createLandmarker("GPU");
        } catch (e) {
          console.warn("GPU delegate failed, falling back to CPU", e);
          delegate = "CPU";
          landmarkerRef.current = await createLandmarker("CPU");
        }
        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // surface mid-session camera unplug / permission revoke instead of freezing
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (!cancelled) {
            stopped = true;
            setStatus("error");
            setError("Камера отключилась. Проверьте подключение и повторите.");
          }
        });

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("ready");
        loop();
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setStatus("error");
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Доступ к камере отклонён. Разрешите камеру в браузере."
            : "Не удалось запустить камеру или загрузить модель ИИ."
        );
      }
    }

    // one-shot recovery: recreate the landmarker on CPU after repeated failures
    // (typical cause — a lost WebGL context mid-session)
    async function reinitLandmarker() {
      reinitInFlight = true;
      try {
        const next = await createLandmarker("CPU");
        if (cancelled) {
          next.close();
          return;
        }
        landmarkerRef.current?.close();
        landmarkerRef.current = next;
        delegate = "CPU";
        errStreak = 0;
        smoother.reset();
      } catch (e) {
        console.error("landmarker re-init failed", e);
        if (!cancelled) {
          stopped = true;
          setStatus("error");
          setError("Сбой анализа позы. Нажмите «Повторить».");
        }
      } finally {
        reinitInFlight = false;
      }
    }

    function loop() {
      if (cancelled || stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const frameIsNew =
        video.readyState >= 2 &&
        video.videoWidth > 0 && // a 0×0 frame during camera renegotiation crashes detect
        video.currentTime !== lastVideoTimeRef.current &&
        !reinitInFlight;

      if (frameIsNew) {
        lastVideoTimeRef.current = video.currentTime;

        // size the canvas only when the video dimensions actually change
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctxRef.current = canvas.getContext("2d");
          drawRef.current = ctxRef.current ? new DrawingUtils(ctxRef.current) : null;
        }
        const ctx = ctxRef.current;
        if (!ctx) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        // MediaPipe VIDEO mode requires strictly increasing timestamps
        const ts = Math.max(performance.now(), lastDetectTs + 1);
        lastDetectTs = ts;

        let result: ReturnType<PoseLandmarker["detectForVideo"]> | null = null;
        try {
          const t0 = performance.now();
          result = landmarker.detectForVideo(video, ts);
          const det = performance.now() - t0;
          detEma = detEma === null ? det : detEma * 0.9 + det * 0.1;
          errStreak = 0;
        } catch (e) {
          errStreak += 1;
          if (errStreak === 1) console.error("detectForVideo failed", e);
          if (errStreak >= REINIT_ERR_STREAK && !reinitStarted) {
            reinitStarted = true;
            void reinitLandmarker();
          }
          if (errStreak >= FATAL_ERR_STREAK) {
            stopped = true;
            setStatus("error");
            setError("Сбой анализа позы. Нажмите «Повторить».");
            return;
          }
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        const dt = ts - lastFrameTs;
        lastFrameTs = ts;
        if (dt > 0) dtEma = dtEma === null ? dt : dtEma * 0.9 + dt * 0.1;

        const lm = result.landmarks?.[0];
        const wl = result.worldLandmarks?.[0];
        const valid =
          lm && lm.length >= 33 && Number.isFinite(lm[0].x) && Number.isFinite(lm[0].y);

        const snap = engine.step(valid ? lm : null, wl, ts);

        for (const ev of engine.takeEvents()) {
          if (ev.type === "rep") {
            if (ev.good) speak(String(ev.count));
            else if (ev.cue) speak(ev.cue);
            onRepRef.current?.({
              good: ev.good,
              cue: ev.cue,
              count: ev.count,
              peakAngle: ev.peakAngle,
              durationMs: ev.durationMs,
            });
          } else if (ev.type === "hold-milestone") {
            speak(`${ev.sec} секунд`, true);
          } else if (ev.type === "hold-target") {
            speak("Отлично! Цель удержания достигнута", true);
          }
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (valid) {
          // the video element is CSS-mirrored; the canvas is not, so text stays
          // readable — mirror the points in code to line up with the video
          const smooth = smoother.smooth(lm, ts);
          const mirrored = smooth.map((p) => ({ ...p, x: 1 - p.x }));
          drawOverlay(ctx, canvas, mirrored, snap);
        } else {
          smoother.reset();
        }

        pushStats(snap, ts);
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    function drawOverlay(
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      lm: NormalizedLandmark[],
      snap: EngineSnapshot
    ) {
      const utils = drawRef.current;
      if (!utils) return;

      // full skeleton, muted — background context
      utils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
        color: "rgba(8,145,178,0.35)",
        lineWidth: 3,
      });
      utils.drawLandmarks(lm, {
        radius: (d) => DrawingUtils.lerp(d.from?.z ?? 0, -0.15, 0.1, 4, 2),
        color: "rgba(34,211,238,0.6)",
        fillColor: "rgba(34,211,238,0.6)",
        lineWidth: 1,
      });

      if (exercise.mode === "balance" || snap.positioning !== "good") return;

      const [ai, bi, ci] = snap.activeJoints;
      const a = lm[ai];
      const b = lm[bi];
      const c = lm[ci];
      if (!a || !b || !c) return;

      const w = canvas.width;
      const h = canvas.height;
      const ax = a.x * w, ay = a.y * h;
      const bx = b.x * w, by = b.y * h;
      const cx = c.x * w, cy = c.y * h;

      const color =
        exercise.mode === "hold"
          ? snap.holding
            ? ZONE_DEEP
            : ZONE_HOLD_OFF
          : snap.depthPct >= 100
            ? ZONE_DEEP
            : ZONE_ACTIVE;

      // tracked joint triplet, highlighted
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      for (const [px, py] of [[ax, ay], [bx, by], [cx, cy]] as const) {
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // angle arc at the vertex
      const r = Math.min(48, Math.max(24, h * 0.06));
      const t1 = Math.atan2(ay - by, ax - bx);
      const t2 = Math.atan2(cy - by, cx - bx);
      let delta = t2 - t1;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.arc(bx, by, r, t1, t2, delta < 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.25);
      ctx.fill();

      // angle readout pill next to the vertex, clamped into the frame
      const label = `${snap.angle}°`;
      ctx.font = "600 16px system-ui, sans-serif";
      const tw = ctx.measureText(label).width;
      const pw = tw + 16;
      const ph = 26;
      const px = Math.min(Math.max(bx + r + 10, 4), w - pw - 4);
      const py = Math.min(Math.max(by - ph / 2, 4), h - ph - 4);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 8);
        ctx.fill();
      } else {
        ctx.fillRect(px, py, pw, ph);
      }
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, px + 8, py + ph / 2 + 1);
    }

    function pushStats(snap: EngineSnapshot, now: number) {
      const changed =
        snap.reps !== lastPushed.reps ||
        snap.stage !== lastPushed.stage ||
        snap.positioning !== lastPushed.positioning ||
        snap.holding !== lastPushed.holding;
      if (!changed && now - lastPushTs < STATS_PUSH_MS) return;
      lastPushTs = now;
      lastPushed = {
        reps: snap.reps,
        stage: snap.stage,
        positioning: snap.positioning,
        holding: snap.holding,
      };
      setStats({
        ...snap,
        fps: dtEma ? Math.round(1000 / dtEma) : 0,
        inferenceMs: detEma ? Math.round(detEma) : 0,
        delegate,
      });
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      ctxRef.current = null;
      drawRef.current = null;
      lastVideoTimeRef.current = -1;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, exercise.key, holdSeconds]);

  return { status, error, stats };
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
