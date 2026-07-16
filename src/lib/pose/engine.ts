// Pure per-frame exercise analysis engine. No React, no camera, no canvas —
// feed it landmarks + a timestamp, read back a snapshot and queued events.
// Keeping it pure makes the rep/hold/balance logic unit-testable with
// synthetic landmark sequences (see engine.test.ts).

import type { ExerciseDef, FormRule } from "@/lib/types";
import {
  calculateAngle,
  inclineFromVertical,
  jointVisible,
  minVisibility,
  mirrorJoints,
  type Point,
} from "./angle";
import { OneEuroFilter } from "./oneEuro";

export type Stage = "up" | "down" | "unknown";
export type Positioning = "good" | "no-pose" | "low-visibility";
export type Side = "left" | "right";
/** which way the patient is turned relative to the camera */
export type Facing = "front" | "side" | "oblique";
/** live phase of the current rep: lengthening under load / shortening / paused */
export type TempoPhase = "eccentric" | "concentric" | "hold" | null;

export type EngineEvent =
  | {
      type: "rep";
      good: boolean;
      cue: string | null;
      count: number;
      /** effort-extreme angle of this rep, degrees */
      peakAngle: number;
      /** effort start → completion, ms (null if the start was occluded) */
      durationMs: number | null;
      /** lengthening-under-load phase of this rep, ms (null if boundaries were occluded) */
      eccentricMs: number | null;
      /** shortening-under-load phase of this rep, ms (null if boundaries were occluded) */
      concentricMs: number | null;
      /** worst frontal-plane knee alignment during the effort (signed °, + valgus / − varus); null unless measured front-on */
      peakValgus: number | null;
    }
  | { type: "hold-milestone"; sec: number }
  | { type: "hold-target" };

export interface EngineSnapshot {
  reps: number;
  goodReps: number;
  violations: number;
  stage: Stage;
  /** smoothed working-joint angle, degrees */
  angle: number;
  positioning: Positioning;
  /** 0-100 posture stability, balance mode */
  balanceScore: number;
  /** peak range of motion this session, degrees */
  achievedROM: number;
  /** body side currently tracked */
  side: Side;
  /** joint triplet for the tracked side — for overlay highlighting */
  activeJoints: [number, number, number];
  /** left/right symmetry 0-100 while both sides are visible, else null */
  symmetry: number | null;
  /** duration of the last counted rep (effort start → completion), ms */
  lastRepMs: number | null;
  /** mean duration of counted reps, ms */
  avgRepMs: number | null;
  /** hold mode: accumulated time in the correct position, ms */
  holdMs: number;
  /** hold mode: currently in the correct position */
  holding: boolean;
  /** hold mode: total tracked (visible) time, ms — for the efficiency score */
  trackedMs: number;
  /** live progress toward the effort target, 0-100 (≥100 = deep enough) */
  depthPct: number;
  /** how the patient is turned relative to the camera */
  facing: Facing;
  /** the patient is presenting the view the angle can be measured accurately from */
  viewOk: boolean;
  /** guidance to fix the camera view (e.g. "turn side-on"), or null when it's fine */
  viewHint: string | null;
  /** live rep phase (eccentric/concentric/hold), rep mode only */
  tempoPhase: TempoPhase;
  /**
   * Live frontal-plane knee alignment (signed °: + valgus / − varus), worst of
   * both knees. Only produced for exercises with a `valgus` config, measured
   * front-on; null otherwise — a wrong view gives a false reading, so we show
   * nothing rather than something misleading.
   */
  kneeValgus: number | null;
}

// minimum time between counted reps — rejects jitter that briefly recrosses both thresholds
export const MIN_REP_MS = 600;
// a form rule fails the rep when violated on more than this share of effort frames
export const RULE_VIOLATION_SHARE = 0.35;
// the other side must beat the current one by this visibility margin to switch
export const SIDE_SWITCH_MARGIN = 0.15;
// before the first rep the side is still free — a small margin lets the engine
// lock onto whichever side the patient actually presented to the camera
export const SIDE_CAPTURE_MARGIN = 0.05;
// after this long without confident landmarks the in-flight rep is abandoned:
// the patient may have walked away and come back standing → phantom rep risk
export const OCCLUSION_RESET_MS = 1500;
// cap dt so a background-tab gap doesn't credit seconds of "holding"
const MAX_STEP_MS = 500;
// hold mode: voice milestone every N seconds
const HOLD_MILESTONE_SEC = 10;

// orientation: sideness (0 = square to camera, 1 = full profile). Hysteresis
// band so a patient hovering near the boundary doesn't flip the hint on/off.
const SIDE_ON = 0.55;
const FRONT_ON = 0.35;
// valgus needs a stricter "square to the camera" than the turn-hint front gate:
// even a slightly oblique view lets the knee travel forward in the sagittal
// plane and reads as false medial collapse
const FRONT_VALGUS_MAX = 0.25;
// all three joints of each leg must clear this to trust a frontal-plane angle
const VALGUS_MIN_VISIBILITY = 0.6;
// per-frame angular speed below this reads as an isometric pause, not a phase
const TEMPO_EPS = 0.6;
// the live phase must hold this many frames before it commits (anti-jitter)
const TEMPO_STABLE_FRAMES = 3;

const TOO_FAST_CUE = "Слишком быстро — выполняйте плавнее";
const SLOW_ECCENTRIC_CUE = "Опускайтесь медленнее и под контролем";
const TURN_SIDE_CUE = "Встаньте боком к камере";
const TURN_FRONT_CUE = "Повернитесь лицом к камере";

export interface EngineOptions {
  /**
   * rep mode: required pause at the effort extreme, from the treatment plan.
   * hold mode: overrides the exercise's default holdTargetSec.
   */
  holdSeconds?: number;
}

interface RuleState {
  rule: FormRule;
  effortFrames: number;
  violatedFrames: number;
}

export class ExerciseEngine {
  private readonly def: ExerciseDef;
  private readonly opts: EngineOptions;
  private readonly effortIsFlex: boolean;
  private readonly depthMargin: number;
  private readonly use3D: boolean;
  private readonly sideSelect: boolean;
  /** camera view the angle is trustworthy from; null = orientation not checked */
  private readonly desiredView: "side" | "front" | null;
  private readonly jointsBySide: Record<Side, [number, number, number]>;

  private side: Side = "right";
  private visEma: Record<Side, number | null> = { left: null, right: null };
  private filter = new OneEuroFilter(1.0, 0.05);
  private visible = false;

  private stage: Stage = "unknown";
  private cycle: "rest" | "effort" | "unknown" = "unknown";
  private peak: number;
  private bestEffort: number;
  private reps = 0;
  private goodReps = 0;
  private violations = 0;
  private lastRepTs = 0;

  private effortStartTs: number | null = null;
  private effortZoneMs = 0; // time spent at the effort extreme within the current rep
  private lastRepMs: number | null = null;
  private repMsSum = 0;
  private repMsCount = 0;
  private lastVisibleTs: number | null = null;

  // tempo split: leftRestTs marks when the angle first left the rest zone (start
  // of the eccentric/concentric approach — earlier than effortStartTs, which
  // fires only at the deeper effort threshold and would drop the first slice);
  // peakTs marks the turnaround. Splitting by the tracked peak is robust to the
  // per-frame jitter that integrating angular speed would accumulate.
  private leftRestTs: number | null = null;
  private peakTs: number | null = null;
  private tempoPhase: TempoPhase = null;
  private tempoCand: TempoPhase = null;
  private tempoStreak = 0;

  // frontal-plane knee alignment (valgus). worstValgus tracks the effort peak;
  // kneeValgus is the live worst-of-both-knees for the HUD.
  private frontOkForValgus = false;
  private worstValgus: number | null = null;
  private kneeValgus: number | null = null;

  private rules: RuleState[];

  private asymEma: number | null = null;

  private lastStepTs: number | null = null;
  private holdMs = 0;
  private holding = false;
  private trackedMs = 0;
  private lastMilestone = 0;
  private holdTargetFired = false;

  private swayMean: number | null = null;
  private sway = 0;
  private balance = 100;

  private sideEma: number | null = null;
  private facing: Facing = "side";
  private viewOk = true;
  private viewHint: string | null = null;

  private lastAngle = 0;
  private events: EngineEvent[] = [];
  // width/height of the source frame. Normalized landmark coords are
  // anisotropic (x spans width, y spans height), which skews 2D angles by up
  // to ~10° at 16:9 — scaling x by the aspect restores true geometry.
  private aspect = 1;

  constructor(def: ExerciseDef, opts: EngineOptions = {}) {
    this.def = def;
    this.opts = opts;
    this.effortIsFlex = def.effortPhase !== "extend";
    this.depthMargin = def.depthMargin ?? 5;
    this.use3D = def.plane === "frontal";
    this.sideSelect = def.sideSelect ?? def.mode !== "balance";
    this.desiredView =
      def.mode === "balance" ? null : (def.view ?? (def.plane === "frontal" ? "front" : "side"));
    this.jointsBySide = {
      right: def.joint,
      left: mirrorJoints(def.joint),
    };
    this.peak = this.effortIsFlex ? 180 : 0;
    this.bestEffort = this.effortIsFlex ? 180 : 0;
    this.rules = (def.formRules ?? []).map((rule) => ({
      rule,
      effortFrames: 0,
      violatedFrames: 0,
    }));
  }

  /** Events queued since the last call (rep completions, hold milestones). */
  takeEvents(): EngineEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Source frame aspect ratio (width/height); call once the video size is known. */
  setAspect(aspect: number) {
    if (Number.isFinite(aspect) && aspect > 0) this.aspect = aspect;
  }

  /**
   * External discontinuity (hidden tab, model swap, camera change): abandon the
   * in-flight rep and demand a fresh rest → effort → rest cycle before counting.
   */
  resetCycle() {
    this.cycle = "unknown";
    this.stage = "unknown";
    this.peak = this.effortIsFlex ? 180 : 0;
    this.effortStartTs = null;
    this.effortZoneMs = 0;
    this.leftRestTs = null;
    this.peakTs = null;
    this.worstValgus = null;
    this.tempoPhase = null;
    this.tempoCand = null;
    this.tempoStreak = 0;
    this.holding = false;
    this.filter.reset();
  }

  /** x scaled by the frame aspect so 2D angles are measured in true geometry. */
  private scaled(p: Point): Point {
    return this.aspect === 1 ? p : { x: p.x * this.aspect, y: p.y, z: p.z, visibility: p.visibility };
  }

  private angle2D(a: Point, b: Point, c: Point): number {
    return calculateAngle(this.scaled(a), this.scaled(b), this.scaled(c));
  }

  /** Analyze one video frame. `wl` = world landmarks (metric 3D), if available. */
  step(lm: Point[] | null | undefined, wl: Point[] | null | undefined, t: number): EngineSnapshot {
    const dt = this.lastStepTs === null ? 0 : Math.min(Math.max(t - this.lastStepTs, 0), MAX_STEP_MS);
    this.lastStepTs = t;

    if (!lm || lm.length === 0) {
      this.handleOcclusion(t);
      return this.snapshot("no-pose", this.lastAngle);
    }

    if (this.def.mode === "balance") return this.stepBalance(lm);

    this.maybeSwitchSide(lm);
    const joints = this.jointsBySide[this.side];
    const [ai, bi, ci] = joints;

    if (!jointVisible(lm[ai], lm[bi], lm[ci]) || !this.updateVisibility(lm, joints)) {
      this.handleOcclusion(t);
      return this.snapshot("low-visibility", this.lastAngle);
    }
    this.lastVisibleTs = t;
    this.updateOrientation(lm, wl);

    // 3D world angle for frontal-plane moves (resists foreshortening), else
    // aspect-corrected 2D
    const src = this.use3D && wl ? wl : lm;
    const raw =
      this.use3D && wl
        ? calculateAngle(src[ai], src[bi], src[ci], true)
        : this.angle2D(src[ai], src[bi], src[ci]);
    const angle = this.filter.filter(raw, t);
    // live eccentric/concentric phase from the smoothed angle's velocity
    if (this.def.mode === "rep") this.updateTempoPhase(angle);
    this.lastAngle = angle;

    this.updateSymmetry(src, raw);

    // live frontal-plane knee alignment, for exercises that request it
    this.kneeValgus = this.def.valgus ? this.computeValgus(lm) : null;

    if (this.def.mode === "hold") {
      this.stepHold(angle, dt);
      this.trackedMs += dt;
    } else {
      this.stepRep(lm, angle, t, dt);
    }

    return this.snapshot("good", angle);
  }

  /**
   * Landmarks are missing or unreliable. Keep the rep state intact through a
   * brief flicker, but after a long gap abandon the in-flight rep: the patient
   * may have walked away and come back standing, which would otherwise complete
   * a phantom rep with a stale effort peak.
   */
  private handleOcclusion(t: number) {
    this.holding = false;
    if (
      this.lastVisibleTs !== null &&
      t - this.lastVisibleTs > OCCLUSION_RESET_MS &&
      this.cycle !== "unknown"
    ) {
      this.resetCycle();
    }
  }

  // ---- side selection ------------------------------------------------------

  private maybeSwitchSide(lm: Point[]) {
    if (!this.sideSelect) return;
    for (const side of ["left", "right"] as const) {
      const vis = minVisibility(lm, this.jointsBySide[side]);
      const prev = this.visEma[side];
      this.visEma[side] = prev === null ? vis : prev * 0.9 + vis * 0.1;
    }
    // never switch mid-effort — the angle stream (and rep peak) would jump sides
    if (this.cycle === "effort" || this.holding) return;
    // before the first rep the choice is still free (small margin); afterwards
    // switching demands a clear visibility win to prevent side ping-pong
    const margin = this.reps === 0 && this.cycle === "unknown" ? SIDE_CAPTURE_MARGIN : SIDE_SWITCH_MARGIN;
    const other: Side = this.side === "right" ? "left" : "right";
    if ((this.visEma[other] ?? 0) > (this.visEma[this.side] ?? 0) + margin) {
      this.side = other;
      this.filter.reset(); // angle continuity breaks across sides
      this.cycle = "unknown"; // demand a fresh rest → effort → rest cycle
      this.stage = "unknown";
      this.effortStartTs = null;
      this.effortZoneMs = 0;
      this.leftRestTs = null;
      this.peakTs = null;
      this.worstValgus = null;
    }
  }

  // ---- orientation ---------------------------------------------------------

  /**
   * Estimate how side-on the patient is and, if it doesn't match the view the
   * exercise is measured from, produce a "turn" hint. A sagittal knee/elbow
   * angle read from the front (or vice-versa) is off by tens of degrees, so the
   * cheapest accuracy win is catching the wrong pose and asking them to turn.
   */
  private updateOrientation(lm: Point[], wl?: Point[] | null) {
    if (this.desiredView === null) return;
    const ls = lm[11];
    const rs = lm[12];
    if ((ls?.visibility ?? 0) < 0.5 || (rs?.visibility ?? 0) < 0.5) {
      // can't confirm orientation without the shoulders — don't trust a stale
      // "front" verdict for valgus (fail-closed rather than measure blind)
      this.frontOkForValgus = false;
      return;
    }

    let sideness: number;
    if (wl && wl[11] && wl[12]) {
      // world landmarks are metric & gravity-aligned: facing the camera the
      // shoulders separate mostly in X (width); side-on, mostly in Z (depth)
      const dx = Math.abs(wl[11].x - wl[12].x);
      const dz = Math.abs((wl[11].z ?? 0) - (wl[12].z ?? 0));
      sideness = dz / (dx + dz + 1e-6);
    } else {
      // 2D fallback: shoulder width collapses relative to torso height side-on
      const sw = Math.abs(ls.x - rs.x) * this.aspect;
      const shY = (ls.y + rs.y) / 2;
      const lh = lm[23];
      const rh = lm[24];
      const hiY = lh && rh ? (lh.y + rh.y) / 2 : shY + 0.25;
      const th = Math.abs(hiY - shY) || 1e-6;
      const ratio = sw / th; // ≈1 facing, ≈0.1 side-on
      sideness = Math.min(1, Math.max(0, (0.6 - ratio) / (0.6 - 0.2)));
    }

    this.sideEma = this.sideEma === null ? sideness : this.sideEma * 0.85 + sideness * 0.15;
    const s = this.sideEma;
    this.facing = s >= SIDE_ON ? "side" : s <= FRONT_ON ? "front" : "oblique";
    this.viewOk = this.facing === this.desiredView;
    this.viewHint = this.viewOk
      ? null
      : this.desiredView === "side"
        ? TURN_SIDE_CUE
        : TURN_FRONT_CUE;
    // valgus demands a squarer front than the turn hint: an oblique view fakes
    // medial knee travel, so only trust the frontal-plane angle well inside FRONT
    this.frontOkForValgus = this.desiredView === "front" && this.facing === "front" && s <= FRONT_VALGUS_MAX;
  }

  // ---- tempo (eccentric / concentric) --------------------------------------

  /** Commit a live rep phase from the smoothed angle's velocity, with a
   *  deadband for pauses and a short streak to reject jitter at turnaround. */
  private updateTempoPhase(angle: number) {
    const vel = angle - this.lastAngle; // degrees since the previous frame
    let cand: TempoPhase;
    if (Math.abs(vel) < TEMPO_EPS) {
      cand = "hold";
    } else {
      const towardEffort = this.effortIsFlex ? vel < 0 : vel > 0;
      const eccentric = this.effortIsFlex ? towardEffort : !towardEffort;
      cand = eccentric ? "eccentric" : "concentric";
    }
    if (cand === this.tempoCand) this.tempoStreak += 1;
    else {
      this.tempoCand = cand;
      this.tempoStreak = 1;
    }
    if (this.tempoStreak >= TEMPO_STABLE_FRAMES) this.tempoPhase = cand;
  }

  // ---- valgus (frontal-plane knee alignment) -------------------------------

  /**
   * Signed frontal-plane projection angle for one leg: how far the knee sits off
   * the hip→ankle line, in the image plane. + = knee medial to the line (valgus),
   * − = lateral (varus). Uses 2D image coords (aspect-scaled): world-Z is the
   * noisiest MediaPipe axis exactly in the frontal view, so 3D would be garbage.
   */
  private legFPPA(hip: Point, knee: Point, ankle: Point, midHipX: number): number | null {
    const h = this.scaled(hip);
    const k = this.scaled(knee);
    const a = this.scaled(ankle);
    const dy = a.y - h.y;
    if (Math.abs(dy) < 1e-6) return null; // hip/ankle level — no vertical line to project onto
    const magnitude = 180 - calculateAngle(h, k, a); // 0 = straight leg
    const lineX = h.x + (a.x - h.x) * ((k.y - h.y) / dy); // hip→ankle line at knee height
    const medialDir = Math.sign(midHipX - h.x); // toward the body midline
    const valgusSign = Math.sign(k.x - lineX) === medialDir ? 1 : -1;
    return valgusSign * magnitude;
  }

  /** Worst (largest-magnitude, signed) frontal-plane knee angle across both legs,
   *  or null when the view/visibility can't support an honest measurement. */
  private computeValgus(lm: Point[]): number | null {
    if (!this.frontOkForValgus) return null;
    if (minVisibility(lm, [23, 24, 25, 26, 27, 28]) < VALGUS_MIN_VISIBILITY) return null;
    const midHipX = (this.scaled(lm[23]).x + this.scaled(lm[24]).x) / 2;
    const right = this.legFPPA(lm[24], lm[26], lm[28], midHipX);
    const left = this.legFPPA(lm[23], lm[25], lm[27], midHipX);
    const cands = [right, left].filter((v): v is number => v !== null);
    if (cands.length === 0) return null;
    return cands.reduce((worst, v) => (Math.abs(v) > Math.abs(worst) ? v : worst), cands[0]);
  }

  /** Fold the live knee alignment into the rep's worst-so-far (by magnitude). */
  private accumulateValgus() {
    if (
      this.kneeValgus !== null &&
      (this.worstValgus === null || Math.abs(this.kneeValgus) > Math.abs(this.worstValgus))
    ) {
      this.worstValgus = this.kneeValgus;
    }
  }

  // ---- shared gates --------------------------------------------------------

  private updateVisibility(lm: Point[], joints: number[]): boolean {
    const minVis = minVisibility(lm, joints);
    // hysteresis: trust above 0.6, distrust below 0.4 — stops status flicker
    if (this.visible && minVis < 0.4) this.visible = false;
    else if (!this.visible && minVis > 0.6) this.visible = true;
    return this.visible;
  }

  private updateSymmetry(src: Point[], rawActive: number) {
    const other: Side = this.side === "right" ? "left" : "right";
    const [oa, ob, oc] = this.jointsBySide[other];
    const active = this.jointsBySide[this.side];
    const bothVisible =
      jointVisible(src[oa], src[ob], src[oc]) &&
      jointVisible(src[active[0]], src[active[1]], src[active[2]]);
    if (!bothVisible) return; // keep the last estimate; UI shows it as-is
    const otherAngle = this.use3D
      ? calculateAngle(src[oa], src[ob], src[oc], true)
      : this.angle2D(src[oa], src[ob], src[oc]);
    const asym = Math.abs(rawActive - otherAngle);
    this.asymEma = this.asymEma === null ? asym : this.asymEma * 0.8 + asym * 0.2;
  }

  // ---- rep mode ------------------------------------------------------------

  private stepRep(lm: Point[], angle: number, t: number, dt: number) {
    const { downAngle, upAngle } = this.def;

    this.stage = angle <= downAngle ? "down" : angle >= upAngle ? "up" : this.stage;

    const atRest = this.effortIsFlex ? angle > upAngle : angle < downAngle;
    const atEffort = this.effortIsFlex ? angle < downAngle : angle > upAngle;

    // committed direction of travel (from the streak-filtered tempo phase):
    // toward the effort extreme, or retreating back toward rest
    const approaching = this.effortIsFlex ? this.tempoPhase === "eccentric" : this.tempoPhase === "concentric";
    const retreating = this.effortIsFlex ? this.tempoPhase === "concentric" : this.tempoPhase === "eccentric";

    if (this.cycle === "unknown") {
      if (atRest) this.cycle = "rest";
      return;
    }

    if (this.cycle === "rest") {
      // Anchor the phase timer at the start of the committed approach. Drop the
      // anchor whenever the patient is in the rest zone or actively retreating,
      // so a false start or a mid-zone hover isn't folded into the eccentric.
      if (atRest || retreating) {
        this.leftRestTs = null;
        this.worstValgus = null;
      } else if (this.leftRestTs === null && approaching) {
        this.leftRestTs = t;
      }
      this.accumulateValgus(); // track alignment across the whole approach, not just below the effort threshold
      if (atEffort) {
        this.cycle = "effort";
        this.peak = angle;
        this.peakTs = t;
        this.effortStartTs = t;
        this.effortZoneMs = 0;
        for (const r of this.rules) {
          r.effortFrames = 0;
          r.violatedFrames = 0;
        }
      }
      return;
    }

    // cycle === "effort"
    const newPeak = this.effortIsFlex ? Math.min(this.peak, angle) : Math.max(this.peak, angle);
    if (newPeak !== this.peak) {
      this.peak = newPeak;
      this.peakTs = t; // turnaround = deepest point reached so far
    }
    this.bestEffort = this.effortIsFlex
      ? Math.min(this.bestEffort, this.peak)
      : Math.max(this.bestEffort, this.peak);
    if (atEffort) this.effortZoneMs += dt; // pause time at the extreme, for holdSeconds
    this.accumulateValgus();
    this.evaluateRules(lm);

    if (atRest) {
      if (t - this.lastRepTs >= MIN_REP_MS) {
        this.lastRepTs = t;
        this.completeRep(t);
      }
      this.cycle = "rest";
      this.effortStartTs = null;
      this.effortZoneMs = 0;
      this.leftRestTs = null;
      this.peakTs = null;
      this.worstValgus = null;
    }
  }

  private completeRep(t: number) {
    this.reps += 1;

    const depthOk = this.effortIsFlex
      ? this.peak <= this.def.downAngle - this.depthMargin
      : this.peak >= this.def.upAngle + this.depthMargin;

    const brokenRule = this.rules.find(
      (r) =>
        r.effortFrames >= 3 && r.violatedFrames / r.effortFrames > RULE_VIOLATION_SHARE
    );

    const holdNeedMs = (this.opts.holdSeconds ?? 0) * 1000;
    const holdOk = holdNeedMs === 0 || this.effortZoneMs >= holdNeedMs;

    const repMs = this.effortStartTs !== null ? t - this.effortStartTs : null;
    const tooFast =
      repMs !== null && this.def.minTempoMs !== undefined && repMs < this.def.minTempoMs;

    if (repMs !== null) {
      this.lastRepMs = repMs;
      this.repMsSum += repMs;
      this.repMsCount += 1;
    }

    // split by the turnaround: approach (leaving rest → peak) and return
    // (peak → rest). Which one is the eccentric depends on where the effort is:
    // a squat lengthens the quads on the way DOWN (approach), a bridge on the way
    // DOWN too — but that's its return. Map through effortIsFlex, never hardcode.
    const startTs = this.leftRestTs ?? this.effortStartTs;
    const approachMs = this.peakTs !== null && startTs !== null ? this.peakTs - startTs : null;
    const returnMs = this.peakTs !== null ? t - this.peakTs : null;
    const eccentricMs = this.effortIsFlex ? approachMs : returnMs;
    const concentricMs = this.effortIsFlex ? returnMs : approachMs;

    const slowEnough =
      this.def.minEccentricMs === undefined ||
      eccentricMs === null ||
      eccentricMs >= this.def.minEccentricMs;

    const good = depthOk && !brokenRule && holdOk && !tooFast && slowEnough;
    let cue: string | null = null;
    if (!depthOk) cue = this.def.shallowCue ?? "Шире амплитуду";
    else if (brokenRule) cue = brokenRule.rule.cue;
    else if (!holdOk) cue = `Задержитесь в этом положении на ${this.opts.holdSeconds} с`;
    else if (tooFast) cue = TOO_FAST_CUE;
    else if (!slowEnough) cue = SLOW_ECCENTRIC_CUE;

    if (good) this.goodReps += 1;
    else this.violations += 1;

    this.events.push({
      type: "rep",
      good,
      cue,
      count: this.reps,
      peakAngle: Math.round(this.peak),
      durationMs: repMs === null ? null : Math.round(repMs),
      eccentricMs: eccentricMs === null ? null : Math.round(eccentricMs),
      concentricMs: concentricMs === null ? null : Math.round(concentricMs),
      // valgus never gates the rep — it's a measurement, not a pass/fail (the
      // camera's absolute valgus error is far too large for pass/fail)
      peakValgus: this.worstValgus === null ? null : Math.round(this.worstValgus),
    });
  }

  private evaluateRules(lm: Point[]) {
    for (const r of this.rules) {
      const value = this.ruleValue(r.rule, lm);
      if (value === null) continue; // rule joints occluded — don't judge blind
      r.effortFrames += 1;
      const { min, max } = r.rule;
      if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
        r.violatedFrames += 1;
      }
    }
  }

  private ruleValue(rule: FormRule, lm: Point[]): number | null {
    const joints = this.side === "right" ? rule.joints : mirrorJoints(rule.joints);
    if (rule.kind === "incline") {
      const [top, bottom] = joints;
      if (!jointVisible(lm[top], lm[bottom], lm[bottom])) return null;
      return inclineFromVertical(this.scaled(lm[top]), this.scaled(lm[bottom]));
    }
    const [a, b, c] = joints;
    if (!jointVisible(lm[a], lm[b], lm[c])) return null;
    return this.angle2D(lm[a], lm[b], lm[c]);
  }

  // ---- hold mode -----------------------------------------------------------

  private stepHold(angle: number, dt: number) {
    const inZone = angle >= this.def.downAngle && angle <= this.def.upAngle;
    this.holding = inZone;
    if (!inZone) return;

    this.holdMs += dt;
    const sec = Math.floor(this.holdMs / 1000);
    const milestone = Math.floor(sec / HOLD_MILESTONE_SEC) * HOLD_MILESTONE_SEC;
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      this.events.push({ type: "hold-milestone", sec: milestone });
    }
    const target = this.opts.holdSeconds || this.def.holdTargetSec;
    if (target && !this.holdTargetFired && sec >= target) {
      this.holdTargetFired = true;
      this.events.push({ type: "hold-target" });
    }
  }

  // ---- balance mode --------------------------------------------------------

  private stepBalance(lm: Point[]): EngineSnapshot {
    // sway of the hip midpoint (landmarks 23/24) → stability score
    const lh = lm[23];
    const rh = lm[24];
    if (!jointVisible(lh, rh, lm[this.def.joint[1]])) {
      return this.snapshot("low-visibility", 0);
    }
    const midX = (((lh?.x ?? 0) + (rh?.x ?? 0)) / 2) * this.aspect;
    this.swayMean = this.swayMean === null ? midX : this.swayMean * 0.95 + midX * 0.05;
    const dev = Math.abs(midX - this.swayMean);
    this.sway = this.sway * 0.9 + dev * 0.1;
    // normalize by torso length so the score doesn't inflate with camera distance
    const ls = lm[11];
    const rs = lm[12];
    const torso =
      jointVisible(ls, rs, lh)
        ? Math.hypot(((ls.x + rs.x) / 2) * this.aspect - midX, (ls.y + rs.y) / 2 - (lh.y + rh.y) / 2)
        : null;
    const swayNorm = torso && torso > 0.05 ? this.sway / torso : this.sway * 3; // 3 ≈ 1/typical torso
    this.balance = Math.max(0, Math.min(100, Math.round(100 - swayNorm * 500)));
    return this.snapshot("good", 0);
  }

  // ---- snapshot ------------------------------------------------------------

  private depthPct(angle: number): number {
    const { downAngle, upAngle } = this.def;
    if (this.def.mode === "hold") {
      // distance to the hold zone; ≥100 = inside
      if (angle >= downAngle && angle <= upAngle) return 100;
      const gap = angle < downAngle ? downAngle - angle : angle - upAngle;
      return Math.max(0, Math.round(100 - gap * 5));
    }
    const target = this.effortIsFlex ? downAngle - this.depthMargin : upAngle + this.depthMargin;
    const rest = this.effortIsFlex ? upAngle : downAngle;
    const span = rest - target;
    if (span === 0) return 0;
    const pct = ((rest - angle) / span) * 100;
    return Math.max(0, Math.min(130, Math.round(pct)));
  }

  private snapshot(positioning: Positioning, angle: number): EngineSnapshot {
    const achievedROM =
      this.def.mode !== "rep"
        ? 0
        : this.effortIsFlex
          ? Math.max(0, Math.round(180 - this.bestEffort))
          : Math.round(this.bestEffort);
    return {
      reps: this.reps,
      goodReps: this.goodReps,
      violations: this.violations,
      stage: this.stage,
      angle: Math.round(angle),
      positioning,
      balanceScore: this.balance,
      achievedROM,
      side: this.side,
      activeJoints: this.jointsBySide[this.side],
      symmetry:
        this.asymEma === null
          ? null
          : Math.round(100 - Math.min(40, Math.max(0, this.asymEma)) * 2.5),
      lastRepMs: this.lastRepMs,
      avgRepMs: this.repMsCount > 0 ? Math.round(this.repMsSum / this.repMsCount) : null,
      holdMs: Math.round(this.holdMs),
      holding: this.holding,
      trackedMs: Math.round(this.trackedMs),
      depthPct: positioning === "good" ? this.depthPct(angle) : 0,
      facing: this.facing,
      // only nag about the view while the body is actually tracked
      viewOk: positioning === "good" ? this.viewOk : true,
      viewHint: positioning === "good" ? this.viewHint : null,
      tempoPhase: positioning === "good" ? this.tempoPhase : null,
      kneeValgus: positioning === "good" ? this.kneeValgus : null,
    };
  }
}
