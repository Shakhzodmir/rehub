import { describe, expect, it } from "vitest";
import type { ExerciseDef } from "@/lib/types";
import { ExerciseEngine, type EngineEvent, type EngineSnapshot } from "./engine";
import type { Point } from "./angle";

// ---------------------------------------------------------------------------
// synthetic-landmark helpers
// ---------------------------------------------------------------------------

const FRAME_MS = 33;

function emptyLm(): Point[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
}

/**
 * Build a frame for a hip(24)-knee(26)-ankle(28) squat with a given knee angle.
 * The knee sits at (0.5, 0.5), the ankle straight below; the hip is rotated
 * `angle` degrees away from the ankle direction. The left leg (23/25/27)
 * mirrors the right one unless `leftAngle` overrides it. The shoulder (12/11)
 * sits above the hip offset by `leanX` (for the trunk-incline rule).
 */
function squatFrame(angle: number, opts: { leftAngle?: number; leanX?: number; rightVis?: number; leftVis?: number } = {}): Point[] {
  const lm = emptyLm();
  const rad = (angle * Math.PI) / 180;
  const place = (hip: number, knee: number, ankle: number, shoulder: number, a: number, vis: number) => {
    const r = (a * Math.PI) / 180;
    lm[knee] = { x: 0.5, y: 0.5, visibility: vis };
    lm[ankle] = { x: 0.5, y: 0.7, visibility: vis };
    lm[hip] = { x: 0.5 + 0.2 * Math.sin(r), y: 0.5 + 0.2 * Math.cos(r), visibility: vis };
    lm[shoulder] = { x: lm[hip].x + (opts.leanX ?? 0), y: lm[hip].y - 0.25, visibility: vis };
  };
  place(24, 26, 28, 12, angle, opts.rightVis ?? 0.95);
  place(23, 25, 27, 11, opts.leftAngle ?? angle, opts.leftVis ?? 0.95);
  void rad;
  return lm;
}

/** Drive the engine through a list of [angle, frames] segments. */
function run(
  engine: ExerciseEngine,
  segments: Array<{ angle?: number; frames: number; lm?: (i: number) => Point[] | null }>,
  startT = 1000
): { t: number; events: EngineEvent[]; last: EngineSnapshot } {
  let t = startT;
  const events: EngineEvent[] = [];
  let last!: EngineSnapshot;
  for (const seg of segments) {
    for (let i = 0; i < seg.frames; i++) {
      t += FRAME_MS;
      const lm = seg.lm ? seg.lm(i) : squatFrame(seg.angle!);
      last = engine.step(lm, undefined, t);
      events.push(...engine.takeEvents());
    }
  }
  return { t, events, last };
}

function squatDef(overrides: Partial<ExerciseDef> = {}): ExerciseDef {
  return {
    key: "squats",
    name: "Приседания",
    emoji: "",
    focus: "",
    description: "",
    difficulty: "Среднее",
    mode: "rep",
    joint: [24, 26, 28],
    downAngle: 100,
    upAngle: 160,
    effortPhase: "flex",
    depthMargin: 8,
    plane: "sagittal",
    shallowCue: "Глубже",
    cues: [],
    ...overrides,
  };
}

/** rest → descend → bottom → ascend → rest, returns collected events */
function oneRep(engine: ExerciseEngine, bottom = 80, bottomFrames = 8) {
  return run(engine, [
    { angle: 175, frames: 12 },
    ...ramp(175, bottom, 8),
    { angle: bottom, frames: bottomFrames },
    ...ramp(bottom, 175, 8),
    { angle: 175, frames: 8 },
  ]);
}

function ramp(from: number, to: number, steps: number) {
  return Array.from({ length: steps }, (_, i) => ({
    angle: from + ((to - from) * (i + 1)) / steps,
    frames: 1,
  }));
}

// ---------------------------------------------------------------------------

describe("rep counting", () => {
  it("counts a deep rep as good", () => {
    const engine = new ExerciseEngine(squatDef());
    const { events, last } = oneRep(engine, 80);
    const reps = events.filter((e) => e.type === "rep");
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({ good: true, cue: null, count: 1 });
    expect(last.reps).toBe(1);
    expect(last.goodReps).toBe(1);
    expect(last.achievedROM).toBeGreaterThan(90);
  });

  it("flags a shallow rep with the depth cue", () => {
    const engine = new ExerciseEngine(squatDef());
    // bottom 96° crosses the 100° effort threshold but misses 100-8=92°
    const { events } = oneRep(engine, 96);
    const reps = events.filter((e) => e.type === "rep");
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({ good: false, cue: "Глубже" });
  });

  it("reports rep duration and peak angle", () => {
    const engine = new ExerciseEngine(squatDef());
    const { events } = oneRep(engine, 80);
    const rep = events.find((e) => e.type === "rep") as Extract<EngineEvent, { type: "rep" }>;
    expect(rep.durationMs).toBeGreaterThan(300);
    expect(rep.peakAngle).toBeLessThan(92);
  });

  it("flags a too-fast rep when minTempoMs is set", () => {
    const engine = new ExerciseEngine(squatDef({ minTempoMs: 5000 }));
    const { events } = oneRep(engine, 80);
    const rep = events.find((e) => e.type === "rep") as Extract<EngineEvent, { type: "rep" }>;
    expect(rep.good).toBe(false);
    expect(rep.cue).toMatch(/быстро/i);
  });

  it("requires a pause at the extreme when holdSeconds is set", () => {
    const short = new ExerciseEngine(squatDef(), { holdSeconds: 1 });
    // ~0.26 s at the bottom — not enough
    const shortRun = oneRep(short, 80, 8);
    const badRep = shortRun.events.find((e) => e.type === "rep") as Extract<EngineEvent, { type: "rep" }>;
    expect(badRep.good).toBe(false);
    expect(badRep.cue).toMatch(/Задержитесь/);

    const long = new ExerciseEngine(squatDef(), { holdSeconds: 1 });
    // ~1.3 s at the bottom — satisfied
    const longRun = oneRep(long, 80, 40);
    const goodRep = longRun.events.find((e) => e.type === "rep") as Extract<EngineEvent, { type: "rep" }>;
    expect(goodRep.good).toBe(true);
  });
});

describe("form rules", () => {
  it("fails a rep when the trunk leans past the incline limit", () => {
    const engine = new ExerciseEngine(
      squatDef({
        formRules: [
          { id: "trunk-lean", kind: "incline", joints: [12, 24], max: 30, cue: "Спину прямее" },
        ],
      })
    );
    // deep enough, but the shoulder drifts far forward during the effort
    const { events } = run(engine, [
      { angle: 175, frames: 12 },
      ...ramp(175, 80, 8).map((s) => ({ ...s, lm: () => squatFrame(s.angle, { leanX: 0.3 }) })),
      { frames: 10, lm: () => squatFrame(80, { leanX: 0.3 }) },
      ...ramp(80, 175, 8).map((s) => ({ ...s, lm: () => squatFrame(s.angle, { leanX: 0.3 }) })),
      { angle: 175, frames: 8 },
    ]);
    const rep = events.find((e) => e.type === "rep") as Extract<EngineEvent, { type: "rep" }>;
    expect(rep.good).toBe(false);
    expect(rep.cue).toBe("Спину прямее");
  });

  it("keeps a rep good when the trunk stays upright", () => {
    const engine = new ExerciseEngine(
      squatDef({
        formRules: [
          { id: "trunk-lean", kind: "incline", joints: [12, 24], max: 30, cue: "Спину прямее" },
        ],
      })
    );
    const { events } = oneRep(engine, 80);
    const rep = events.find((e) => e.type === "rep") as Extract<EngineEvent, { type: "rep" }>;
    expect(rep.good).toBe(true);
  });
});

describe("side auto-selection", () => {
  it("switches to the left side when the right is occluded", () => {
    const engine = new ExerciseEngine(squatDef());
    const { last } = run(engine, [
      { frames: 10, lm: () => squatFrame(175, { rightVis: 0.2, leftVis: 0.95 }) },
    ]);
    expect(last.side).toBe("left");
    expect(last.positioning).toBe("good");
  });

  it("counts reps tracked on the mirrored side", () => {
    const engine = new ExerciseEngine(squatDef());
    const occluded = (angle: number) => squatFrame(angle, { rightVis: 0.2, leftVis: 0.95 });
    const { events } = run(engine, [
      { frames: 12, lm: () => occluded(175) },
      ...ramp(175, 80, 8).map((s) => ({ ...s, lm: () => occluded(s.angle) })),
      { frames: 8, lm: () => occluded(80) },
      ...ramp(80, 175, 8).map((s) => ({ ...s, lm: () => occluded(s.angle) })),
      { frames: 8, lm: () => occluded(175) },
    ]);
    expect(events.filter((e) => e.type === "rep")).toHaveLength(1);
  });
});

describe("occlusion handling", () => {
  it("abandons an in-flight rep after a long occlusion (no phantom rep)", () => {
    const engine = new ExerciseEngine(squatDef());
    const { events, last } = run(engine, [
      { angle: 175, frames: 12 },
      ...ramp(175, 80, 8),
      { angle: 80, frames: 5 }, // mid-effort …
      { frames: 70, lm: () => null }, // … patient leaves for >1.5 s
      { angle: 175, frames: 15 }, // returns standing
    ]);
    expect(events.filter((e) => e.type === "rep")).toHaveLength(0);
    expect(last.reps).toBe(0);
  });

  it("still counts a clean rep after recovering from occlusion", () => {
    const engine = new ExerciseEngine(squatDef());
    run(engine, [
      { angle: 80, frames: 5 },
      { frames: 70, lm: () => null },
    ]);
    const { events } = oneRep(engine, 80);
    expect(events.filter((e) => e.type === "rep")).toHaveLength(1);
  });
});

describe("symmetry", () => {
  it("reports high symmetry when both sides move together", () => {
    const engine = new ExerciseEngine(squatDef());
    const { last } = run(engine, [{ angle: 120, frames: 20 }]);
    expect(last.symmetry).not.toBeNull();
    expect(last.symmetry!).toBeGreaterThanOrEqual(95);
  });

  it("degrades symmetry when the sides diverge", () => {
    const engine = new ExerciseEngine(squatDef());
    const { last } = run(engine, [
      { frames: 30, lm: () => squatFrame(90, { leftAngle: 150 }) },
    ]);
    expect(last.symmetry).not.toBeNull();
    expect(last.symmetry!).toBeLessThan(50);
  });
});

describe("hold mode", () => {
  const plankDef = (): ExerciseDef =>
    squatDef({
      key: "plank",
      mode: "hold",
      joint: [12, 24, 26],
      downAngle: 155,
      upAngle: 180,
      holdTargetSec: 2,
      formRules: undefined,
    });

  // body-line frame: the hip→knee segment points along +x, the shoulder is
  // rotated `angle` degrees away from it, so the hip angle equals `angle`
  function plankFrame(angle: number): Point[] {
    const lm = emptyLm();
    const r = (angle * Math.PI) / 180;
    for (const [sh, hip, knee] of [
      [12, 24, 26],
      [11, 23, 25],
    ] as const) {
      lm[hip] = { x: 0.5, y: 0.5, visibility: 0.95 };
      lm[knee] = { x: 0.7, y: 0.5, visibility: 0.95 };
      lm[sh] = { x: 0.5 + 0.3 * Math.cos(r), y: 0.5 - 0.3 * Math.sin(r), visibility: 0.95 };
    }
    return lm;
  }

  it("accumulates hold time only inside the zone", () => {
    const engine = new ExerciseEngine(plankDef());
    const inZone = run(engine, [{ frames: 30, lm: () => plankFrame(172) }]);
    expect(inZone.last.holding).toBe(true);
    const heldSoFar = inZone.last.holdMs;
    expect(heldSoFar).toBeGreaterThan(700);

    const outOfZone = run(engine, [{ frames: 30, lm: () => plankFrame(120) }], inZone.t);
    expect(outOfZone.last.holding).toBe(false);
    // sagging paused the timer (the smoothed angle needs a few frames to leave the zone)
    expect(outOfZone.last.holdMs).toBeLessThan(heldSoFar + 500);
  });

  it("fires the hold-target event when the goal is reached", () => {
    const engine = new ExerciseEngine(plankDef());
    const { events } = run(engine, [{ frames: 80, lm: () => plankFrame(172) }]);
    expect(events.some((e) => e.type === "hold-target")).toBe(true);
  });
});

describe("aspect correction", () => {
  it("measures the same angle regardless of frame aspect for axis-aligned limbs", () => {
    // vertical thigh + vertical shin: aspect scaling of x must not change 180°
    const a = new ExerciseEngine(squatDef());
    a.setAspect(16 / 9);
    const { last } = run(a, [{ angle: 180, frames: 15 }]);
    expect(last.angle).toBeGreaterThan(176);
  });

  it("corrects oblique angles that normalized coords would distort", () => {
    // synthetic 135° in square space reads shallower once x is stretched 2×:
    // vectors (sin135°·2, cos135°) vs (0, 1) → ≈117°, not 135°
    const wide = new ExerciseEngine(squatDef());
    wide.setAspect(2);
    const wideRun = run(wide, [{ angle: 135, frames: 20 }]);

    const square = new ExerciseEngine(squatDef());
    const squareRun = run(square, [{ angle: 135, frames: 20 }]);

    expect(squareRun.last.angle).toBeCloseTo(135, 0);
    expect(wideRun.last.angle).toBeCloseTo(117, 0);
  });
});

describe("depth gauge", () => {
  it("grows toward 100 as the movement deepens", () => {
    const engine = new ExerciseEngine(squatDef());
    const standing = run(engine, [{ angle: 175, frames: 10 }]);
    expect(standing.last.depthPct).toBeLessThan(20);
    const deep = run(engine, [...ramp(175, 85, 10), { angle: 85, frames: 10 }], standing.t);
    expect(deep.last.depthPct).toBeGreaterThanOrEqual(100);
  });
});
