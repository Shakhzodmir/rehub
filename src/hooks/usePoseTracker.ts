import { useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type Landmark,
} from "@mediapipe/tasks-vision";
import type { ExerciseDef } from "@/lib/types";
import { calculateAngle, jointVisible } from "@/lib/pose/angle";
import { OneEuroFilter } from "@/lib/pose/oneEuro";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// minimum time between counted reps — rejects jitter that briefly recrosses both thresholds
const MIN_REP_MS = 600;
// don't repeat the same spoken cue more often than this
const SPEAK_COOLDOWN_MS = 1500;

export type Stage = "up" | "down" | "unknown";
export type Positioning = "good" | "no-pose" | "low-visibility";

export interface RepEvent {
  good: boolean;
  cue: string | null;
  count: number;
}

export interface PoseStats {
  reps: number;
  stage: Stage;
  angle: number;
  positioning: Positioning;
  goodReps: number;
  violations: number;
  fps: number;
  /** 0-100 posture stability, balance exercises only */
  balanceScore: number;
  /** peak range of motion reached this session, in degrees */
  achievedROM: number;
}

interface Options {
  exercise: ExerciseDef;
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Russian voice guidance via the Web Speech API */
  voice?: boolean;
  onRep?: (e: RepEvent) => void;
}

const INITIAL: PoseStats = {
  reps: 0,
  stage: "unknown",
  angle: 0,
  positioning: "no-pose",
  goodReps: 0,
  violations: 0,
  fps: 0,
  balanceScore: 100,
  achievedROM: 0,
};

export function usePoseTracker({
  exercise,
  active,
  videoRef,
  canvasRef,
  voice = false,
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

  // mutable tracking state (avoids re-renders inside the rAF loop)
  const repsRef = useRef(0);
  const goodRef = useRef(0);
  const violRef = useRef(0);
  const stageRef = useRef<Stage>("unknown");
  const cycleRef = useRef<"rest" | "effort" | "unknown">("unknown");
  const peakRef = useRef(180); // effort peak within the current rep
  const bestEffortRef = useRef(180); // best effort peak across the session
  const lastRepTsRef = useRef(0);
  const visibleRef = useRef(false);
  const filterRef = useRef<OneEuroFilter | null>(null);
  const lastTsRef = useRef(performance.now());

  // balance-mode stability tracking
  const swayMeanRef = useRef<number | null>(null);
  const swayRef = useRef(0);
  const balanceRef = useRef(100);

  // voice (kept in a ref so toggling it never restarts the camera/model)
  const voiceRef = useRef(voice);
  const lastSpeakRef = useRef(0);
  useEffect(() => {
    voiceRef.current = voice;
    if (!voice && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [voice]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const effortIsFlex = exercise.effortPhase !== "extend";
    const depthMargin = exercise.depthMargin ?? 5;
    const use3D = exercise.plane === "frontal";

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

    async function setup() {
      try {
        setStatus("loading");
        setError(null);
        // reset trackers for a fresh session
        repsRef.current = 0;
        goodRef.current = 0;
        violRef.current = 0;
        stageRef.current = "unknown";
        cycleRef.current = "unknown";
        peakRef.current = effortIsFlex ? 180 : 0;
        bestEffortRef.current = effortIsFlex ? 180 : 0;
        lastRepTsRef.current = 0;
        visibleRef.current = false;
        filterRef.current = new OneEuroFilter(1.0, 0.05);
        swayMeanRef.current = null;
        swayRef.current = 0;
        balanceRef.current = 100;
        setStats(INITIAL);

        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        if (cancelled) return;
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.6,
          minPosePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
          outputSegmentationMasks: false,
        });
        if (cancelled) return;
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
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

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker) return;

      if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
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

        const result = landmarker.detectForVideo(video, performance.now());
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const lm = result.landmarks?.[0];
        const wl = result.worldLandmarks?.[0];
        if (lm) {
          drawSkeleton(lm);
          process(lm, wl);
        } else {
          cycleRef.current = "unknown";
          pushStats("no-pose", 0);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    function drawSkeleton(lm: NormalizedLandmark[]) {
      const utils = drawRef.current;
      if (!utils) return;
      utils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
        color: "rgba(8,145,178,0.9)",
        lineWidth: 4,
      });
      utils.drawLandmarks(lm, {
        radius: (d) => DrawingUtils.lerp(d.from?.z ?? 0, -0.15, 0.1, 5, 2),
        color: "#22D3EE",
        fillColor: "#22D3EE",
        lineWidth: 1,
      });
    }

    function updateVisibility(a?: NormalizedLandmark, b?: NormalizedLandmark, c?: NormalizedLandmark) {
      const minVis = Math.min(a?.visibility ?? 0, b?.visibility ?? 0, c?.visibility ?? 0);
      // hysteresis: trust above 0.6, distrust below 0.4 — stops status flicker
      if (visibleRef.current && minVis < 0.4) visibleRef.current = false;
      else if (!visibleRef.current && minVis > 0.6) visibleRef.current = true;
      return visibleRef.current;
    }

    function process(lm: NormalizedLandmark[], wl?: Landmark[]) {
      const [ai, bi, ci] = exercise.joint;

      if (exercise.mode === "balance") {
        // sway of the hip midpoint (landmarks 23/24) → stability score
        const lh = lm[23];
        const rh = lm[24];
        if (!jointVisible(lh, rh, lm[bi])) {
          pushStats("low-visibility", 0);
          return;
        }
        const midX = ((lh?.x ?? 0) + (rh?.x ?? 0)) / 2;
        swayMeanRef.current =
          swayMeanRef.current === null ? midX : swayMeanRef.current * 0.95 + midX * 0.05;
        const dev = Math.abs(midX - swayMeanRef.current);
        swayRef.current = swayRef.current * 0.9 + dev * 0.1;
        balanceRef.current = Math.max(0, Math.min(100, Math.round(100 - swayRef.current * 1500)));
        pushStats("good", 0);
        return;
      }

      const a = lm[ai];
      const b = lm[bi];
      const c = lm[ci];

      if (!jointVisible(a, b, c) || !updateVisibility(a, b, c)) {
        // keep cycle/peak intact so a brief occlusion mid-rep doesn't drop the count
        pushStats("low-visibility", 0);
        return;
      }

      // 3D world angle for frontal-plane moves (resists foreshortening), else 2D
      const src = use3D && wl ? wl : lm;
      const raw = calculateAngle(src[ai], src[bi], src[ci], use3D);
      const angle = filterRef.current!.filter(raw, performance.now());

      // positional stage (for the HUD)
      stageRef.current =
        angle <= exercise.downAngle ? "down" : angle >= exercise.upAngle ? "up" : stageRef.current;

      const atRest = effortIsFlex ? angle > exercise.upAngle : angle < exercise.downAngle;
      const atEffort = effortIsFlex ? angle < exercise.downAngle : angle > exercise.upAngle;

      if (cycleRef.current === "unknown") {
        if (atRest) cycleRef.current = "rest";
      } else if (cycleRef.current === "rest") {
        if (atEffort) {
          cycleRef.current = "effort";
          peakRef.current = angle;
        }
      } else if (cycleRef.current === "effort") {
        peakRef.current = effortIsFlex
          ? Math.min(peakRef.current, angle)
          : Math.max(peakRef.current, angle);
        bestEffortRef.current = effortIsFlex
          ? Math.min(bestEffortRef.current, peakRef.current)
          : Math.max(bestEffortRef.current, peakRef.current);

        if (atRest) {
          const now = performance.now();
          if (now - lastRepTsRef.current >= MIN_REP_MS) {
            lastRepTsRef.current = now;
            repsRef.current += 1;
            const good = effortIsFlex
              ? peakRef.current <= exercise.downAngle - depthMargin
              : peakRef.current >= exercise.upAngle + depthMargin;
            let cue: string | null = null;
            if (good) {
              goodRef.current += 1;
              speak(String(repsRef.current));
            } else {
              violRef.current += 1;
              cue = exercise.shallowCue ?? "Шире амплитуду";
              speak(cue);
            }
            onRep?.({ good, cue, count: repsRef.current });
          }
          cycleRef.current = "rest";
        }
      }

      pushStats("good", angle);
    }

    function pushStats(positioning: Positioning, angle: number) {
      const now = performance.now();
      const dt = now - lastTsRef.current;
      lastTsRef.current = now;
      const fps = dt > 0 ? Math.round(1000 / dt) : 0;
      const effortIsFlexLocal = exercise.effortPhase !== "extend";
      const achievedROM =
        exercise.mode === "balance"
          ? 0
          : effortIsFlexLocal
            ? Math.max(0, Math.round(180 - bestEffortRef.current))
            : Math.round(bestEffortRef.current);
      setStats({
        reps: repsRef.current,
        goodReps: goodRef.current,
        violations: violRef.current,
        stage: stageRef.current,
        angle: Math.round(angle),
        positioning,
        fps,
        balanceScore: balanceRef.current,
        achievedROM,
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
  }, [active, exercise.key]);

  return { status, error, stats };
}
