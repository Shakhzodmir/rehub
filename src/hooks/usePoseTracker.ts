import { useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { ExerciseDef } from "@/lib/types";
import { calculateAngle, jointVisible } from "@/lib/pose/angle";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export type Stage = "up" | "down" | "unknown";
export type Positioning = "good" | "no-pose" | "low-visibility";

export interface PoseStats {
  reps: number;
  stage: Stage;
  angle: number;
  positioning: Positioning;
  goodReps: number;
  violations: number;
  fps: number;
}

interface Options {
  exercise: ExerciseDef;
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onRep?: (good: boolean) => void;
}

const INITIAL: PoseStats = {
  reps: 0,
  stage: "unknown",
  angle: 0,
  positioning: "no-pose",
  goodReps: 0,
  violations: 0,
  fps: 0,
};

export function usePoseTracker({ exercise, active, videoRef, canvasRef, onRep }: Options) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PoseStats>(INITIAL);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

  // mutable tracking state (avoids re-renders inside the rAF loop)
  const repsRef = useRef(0);
  const goodRef = useRef(0);
  const violRef = useRef(0);
  const stageRef = useRef<Stage>("unknown");
  const minAngleRef = useRef(180); // deepest angle reached during current "down" phase
  const lastTsRef = useRef(performance.now());

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function setup() {
      try {
        setStatus("loading");
        setError(null);
        // reset trackers for a fresh session
        repsRef.current = 0;
        goodRef.current = 0;
        violRef.current = 0;
        stageRef.current = "unknown";
        minAngleRef.current = 180;
        setStats(INITIAL);

        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        if (cancelled) return;
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
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
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        const result = landmarker.detectForVideo(video, performance.now());

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const lm = result.landmarks?.[0];
        if (lm) {
          drawSkeleton(ctx, canvas, lm);
          process(lm);
        } else {
          stageRef.current = "unknown";
          pushStats("no-pose", 0);
        }
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    function drawSkeleton(
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      lm: NormalizedLandmark[]
    ) {
      const utils = new DrawingUtils(ctx);
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

    function process(lm: NormalizedLandmark[]) {
      const [ai, bi, ci] = exercise.joint;
      const a = lm[ai];
      const b = lm[bi];
      const c = lm[ci];

      if (!jointVisible(a, b, c)) {
        pushStats("low-visibility", 0);
        return;
      }

      if (exercise.mode === "balance") {
        // balance: posture quality, no rep counting
        pushStats("good", 0);
        return;
      }

      const angle = calculateAngle(a, b, c);
      const { downAngle, upAngle } = exercise;

      if (angle < downAngle) {
        if (stageRef.current !== "down") {
          stageRef.current = "down";
          minAngleRef.current = angle;
        }
        minAngleRef.current = Math.min(minAngleRef.current, angle);
      } else if (angle > upAngle && stageRef.current === "down") {
        // full rep completed
        stageRef.current = "up";
        repsRef.current += 1;
        // depth check: did the patient reach a clean contraction?
        const good = minAngleRef.current <= downAngle - 5;
        if (good) goodRef.current += 1;
        else violRef.current += 1;
        onRep?.(good);
        minAngleRef.current = 180;
      } else if (angle > upAngle && stageRef.current === "unknown") {
        stageRef.current = "up";
      }

      pushStats("good", angle);
    }

    function pushStats(positioning: Positioning, angle: number) {
      const now = performance.now();
      const dt = now - lastTsRef.current;
      lastTsRef.current = now;
      const fps = dt > 0 ? Math.round(1000 / dt) : 0;
      setStats({
        reps: repsRef.current,
        goodReps: goodRef.current,
        violations: violRef.current,
        stage: stageRef.current,
        angle: Math.round(angle),
        positioning,
        fps,
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
      lastVideoTimeRef.current = -1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, exercise.key]);

  return { status, error, stats };
}
