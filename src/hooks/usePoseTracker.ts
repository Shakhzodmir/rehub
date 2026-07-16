import { useEffect, useRef, useState } from "react";
import {
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
// full is noticeably more accurate (esp. z / world landmarks); lite is the
// fallback for CPU delegates and devices where full can't hold real-time
const MODELS = {
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
} as const;
export type ModelKind = keyof typeof MODELS;

// don't repeat the same spoken cue more often than this
const SPEAK_COOLDOWN_MS = 1500;
// re-prompt the "turn to the camera" hint at most this often
const VIEW_SPEAK_MS = 5000;
// UI re-renders are capped at this rate; rep/stage/positioning changes bypass the cap
const STATS_PUSH_MS = 100;
// this many consecutive detectForVideo failures triggers one CPU re-init …
const REINIT_ERR_STREAK = 5;
// … and this many gives up with a visible error
const FATAL_ERR_STREAK = 60;
// after this warm-up, downgrade full → lite if inference can't hold real time:
// >33 ms inference or <15 fps loop means the skeleton visibly trails the body
const DOWNGRADE_WARMUP_FRAMES = 90;
const DOWNGRADE_INFERENCE_MS = 33;
const DOWNGRADE_FRAME_MS = 66;
// a tab hidden longer than this may hide a pose change — restart the rep cycle
const HIDDEN_RESET_MS = 2000;

type VideoWithVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

// Body-only skeleton (no face mesh, no finger joints). MediaPipe hallucinates
// plausible positions for occluded landmarks; drawing every connection makes
// those guesses show up as wild lines. Segments render only when BOTH
// endpoints are confidently visible.
const BODY_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], [23, 24], // torso
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
  [27, 29], [29, 31], [27, 31], // left foot
  [28, 30], [30, 32], [28, 32], // right foot
];
const BODY_POINTS = Array.from({ length: 22 }, (_, i) => i + 11); // 11..32
const MIN_DRAW_VISIBILITY = 0.5;

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
  /** which landmarker model is running (full = more accurate, lite = fallback) */
  model: ModelKind;
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
  facing: "side",
  viewOk: true,
  viewHint: null,
  fps: 0,
  inferenceMs: 0,
  delegate: "GPU",
  model: "full",
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
    let model: ModelKind = "full";

    // timing / telemetry
    let lastDetectTs = 0;
    let dtEma: number | null = null;
    let detEma: number | null = null;
    let lastFrameTs = performance.now();
    let frameCount = 0;
    let vfcHandle: number | null = null;
    let hiddenAt = 0;

    // failure handling
    let errStreak = 0;
    let reinitStarted = false;
    let reinitInFlight = false;
    let downgradeTried = false;

    // render throttling
    let lastPushTs = 0;
    let lastPushed = { reps: -1, stage: "", positioning: "", holding: false, viewOk: true };
    // orientation-hint voice throttle
    let lastViewSpeak = 0;

    function speak(text: string, force = false) {
      if (!voiceRef.current || typeof window === "undefined") return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      const now = performance.now();
      if (!force && now - lastSpeakRef.current < SPEAK_COOLDOWN_MS) return;
      lastSpeakRef.current = now;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ru-RU";
      u.rate = 1.05;
      const ru = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ru"));
      if (ru) u.voice = ru;
      // Chrome quirks: cancel() immediately followed by speak() can silently
      // swallow the new utterance, and the queue can wedge in a paused state.
      // Cancel only when something is queued, resume, and defer the speak.
      if (synth.speaking || synth.pending) synth.cancel();
      synth.resume();
      window.setTimeout(() => synth.speak(u), 30);
    }

    function createLandmarker(d: Delegate, m: ModelKind) {
      return PoseLandmarker.createFromOptions(vision!, {
        baseOptions: { modelAssetPath: MODELS[m], delegate: d },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputSegmentationMasks: false,
      });
    }

    // schedule the next analysis pass: rVFC fires exactly once per delivered
    // camera frame (no wasted iterations on 120 Hz displays); rAF is the fallback
    function schedule() {
      if (cancelled || stopped) return;
      const video = videoRef.current as VideoWithVFC | null;
      if (video?.requestVideoFrameCallback) {
        vfcHandle = video.requestVideoFrameCallback(() => loop());
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    async function setup() {
      try {
        setStatus("loading");
        setError(null);
        setStats(INITIAL);
        // voice list loads async in Chrome — warm it so ru-RU is ready later
        if (typeof window !== "undefined") window.speechSynthesis?.getVoices();

        vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        if (cancelled) return;
        // accuracy-first cascade: full model on GPU; if the full model or the
        // GPU context fails, degrade one step at a time down to CPU + lite
        try {
          landmarkerRef.current = await createLandmarker("GPU", "full");
        } catch (eFull) {
          console.warn("GPU+full failed, trying GPU+lite", eFull);
          model = "lite";
          try {
            landmarkerRef.current = await createLandmarker("GPU", "lite");
          } catch (eLite) {
            console.warn("GPU delegate failed, falling back to CPU", eLite);
            delegate = "CPU";
            landmarkerRef.current = await createLandmarker("CPU", "lite");
          }
        }
        if (cancelled) return;

        // ask for 1080p — browsers pick the closest supported mode; a low-res
        // stream stretched over the stage is what reads as a "blurry camera"
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16 / 9 }, // avoid soft 4:3 modes when a 16:9 one exists
            frameRate: { ideal: 30 },
            facingMode: "user",
          },
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
        if (video.videoHeight > 0) engine.setAspect(video.videoWidth / video.videoHeight);
        document.addEventListener("visibilitychange", onVisibility);
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

    // a tab hidden for a while can conceal a pose change — demand a fresh
    // rest → effort cycle instead of completing a stale rep on return
    function onVisibility() {
      if (document.hidden) {
        hiddenAt = performance.now();
      } else if (performance.now() - hiddenAt > HIDDEN_RESET_MS) {
        engine.resetCycle();
        smoother.reset();
      }
    }

    // one-shot recovery: recreate the landmarker on CPU after repeated failures
    // (typical cause — a lost WebGL context mid-session)
    async function reinitLandmarker() {
      reinitInFlight = true;
      try {
        const next = await createLandmarker("CPU", "lite");
        if (cancelled) {
          next.close();
          return;
        }
        landmarkerRef.current?.close();
        landmarkerRef.current = next;
        delegate = "CPU";
        model = "lite";
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

    // the full model can't hold real time on this device — swap to lite without
    // losing session state (reps stay; the engine just restarts its cycle)
    async function downgradeModel() {
      reinitInFlight = true;
      try {
        const next = await createLandmarker(delegate, "lite");
        if (cancelled) {
          next.close();
          return;
        }
        landmarkerRef.current?.close();
        landmarkerRef.current = next;
        model = "lite";
        detEma = null; // re-measure latency for the new model
        smoother.reset();
        engine.resetCycle();
      } catch (e) {
        console.warn("model downgrade failed, keeping full", e);
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
        schedule();
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
          engine.setAspect(video.videoWidth / video.videoHeight);
          ctxRef.current = canvas.getContext("2d");
        }
        const ctx = ctxRef.current;
        if (!ctx) {
          schedule();
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
          frameCount += 1;
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
          schedule();
          return;
        }

        // after warm-up (shaders compiled, caches hot) check that the full
        // model holds real time on this device; otherwise drop to lite once
        if (
          model === "full" &&
          !downgradeTried &&
          frameCount > DOWNGRADE_WARMUP_FRAMES &&
          ((detEma !== null && detEma > DOWNGRADE_INFERENCE_MS) ||
            (dtEma !== null && dtEma > DOWNGRADE_FRAME_MS))
        ) {
          downgradeTried = true;
          void downgradeModel();
        }

        const dt = ts - lastFrameTs;
        lastFrameTs = ts;
        if (dt > 0) dtEma = dtEma === null ? dt : dtEma * 0.9 + dt * 0.1;

        const lm = result.landmarks?.[0];
        const wl = result.worldLandmarks?.[0];
        const valid =
          lm && lm.length >= 33 && Number.isFinite(lm[0].x) && Number.isFinite(lm[0].y);

        const snap = engine.step(valid ? lm : null, wl, ts);

        // a wrong camera view makes the angle unreliable — guide the patient to
        // turn before anything else, on its own gentler cadence
        if (snap.viewHint && performance.now() - lastViewSpeak > VIEW_SPEAK_MS) {
          lastViewSpeak = performance.now();
          speak(snap.viewHint, true);
        }

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
      schedule();
    }

    function drawOverlay(
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      lm: NormalizedLandmark[],
      snap: EngineSnapshot
    ) {
      const w = canvas.width;
      const h = canvas.height;
      // stroke metrics were tuned on a 720p canvas — scale them with the
      // actual camera resolution so lines stay equally bold at 1080p+
      const s = Math.max(0.75, h / 720);
      const visible = (i: number) => (lm[i]?.visibility ?? 0) >= MIN_DRAW_VISIBILITY;

      // body skeleton — only confidently visible segments (occluded joints
      // never paint hallucinated lines), opacity follows model confidence,
      // and a dark underlay keeps lines readable over bright clothing/walls
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [i, j] of BODY_CONNECTIONS) {
        if (!visible(i) || !visible(j)) continue;
        const conf = Math.min(lm[i].visibility ?? 1, lm[j].visibility ?? 1);
        const x1 = lm[i].x * w, y1 = lm[i].y * h;
        const x2 = lm[j].x * w, y2 = lm[j].y * h;
        ctx.strokeStyle = `rgba(8,25,35,${(0.35 * conf).toFixed(3)})`;
        ctx.lineWidth = 6 * s;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(34,211,238,${(0.3 + 0.5 * conf).toFixed(3)})`;
        ctx.lineWidth = 3.5 * s;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      for (const i of BODY_POINTS) {
        if (!visible(i)) continue;
        const px = lm[i].x * w, py = lm[i].y * h;
        ctx.beginPath();
        ctx.arc(px, py, 4.5 * s, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8,25,35,0.5)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 3 * s, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(165,243,252,0.95)";
        ctx.fill();
      }

      if (exercise.mode === "balance" || snap.positioning !== "good") return;

      // wrong camera view — a prominent banner asks the patient to turn; the
      // angle below is drawn but marked approximate (~) since it can't be trusted
      if (snap.viewHint) {
        ctx.save();
        ctx.font = `600 ${Math.round(16 * s)}px system-ui, sans-serif`;
        const tw = ctx.measureText(snap.viewHint).width;
        const pad = 14 * s;
        const bw = tw + pad * 2;
        const bh = 34 * s;
        const bx = (w - bw) / 2;
        const by = 14 * s;
        ctx.fillStyle = "rgba(180,83,9,0.92)";
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 10 * s);
          ctx.fill();
        } else {
          ctx.fillRect(bx, by, bw, bh);
        }
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(snap.viewHint, w / 2, by + bh / 2 + 1);
        ctx.restore();
      }

      const [ai, bi, ci] = snap.activeJoints;
      const a = lm[ai];
      const b = lm[bi];
      const c = lm[ci];
      if (!a || !b || !c) return;

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

      // tracked joint triplet, highlighted (soft glow only while perf allows)
      const glow = detEma !== null && detEma < 25;
      ctx.save();
      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 * s;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 7 * s;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
      for (const [px, py] of [[ax, ay], [bx, by], [cx, cy]] as const) {
        ctx.beginPath();
        ctx.arc(px, py, 8 * s, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 3.5 * s, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }

      // angle arc at the vertex
      const r = Math.min(64 * s, Math.max(24, h * 0.06));
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

      // angle readout pill next to the vertex, clamped into the frame.
      // a "~" marks the angle approximate when the view is off-axis
      const label = `${snap.viewOk ? "" : "~"}${snap.angle}°`;
      ctx.font = `600 ${Math.round(16 * s)}px system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const pw = tw + 16 * s;
      const ph = 26 * s;
      const px = Math.min(Math.max(bx + r + 10 * s, 4), w - pw - 4);
      const py = Math.min(Math.max(by - ph / 2, 4), h - ph - 4);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 8 * s);
        ctx.fill();
      } else {
        ctx.fillRect(px, py, pw, ph);
      }
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, px + 8 * s, py + ph / 2 + 1);
    }

    function pushStats(snap: EngineSnapshot, now: number) {
      const changed =
        snap.reps !== lastPushed.reps ||
        snap.stage !== lastPushed.stage ||
        snap.positioning !== lastPushed.positioning ||
        snap.holding !== lastPushed.holding ||
        snap.viewOk !== lastPushed.viewOk;
      if (!changed && now - lastPushTs < STATS_PUSH_MS) return;
      lastPushTs = now;
      lastPushed = {
        reps: snap.reps,
        stage: snap.stage,
        positioning: snap.positioning,
        holding: snap.holding,
        viewOk: snap.viewOk,
      };
      setStats({
        ...snap,
        fps: dtEma ? Math.round(1000 / dtEma) : 0,
        inferenceMs: detEma ? Math.round(detEma) : 0,
        delegate,
        model,
      });
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (vfcHandle !== null) {
        (videoRef.current as VideoWithVFC | null)?.cancelVideoFrameCallback?.(vfcHandle);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      ctxRef.current = null;
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
