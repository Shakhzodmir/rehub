export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Angle (degrees) at vertex b formed by a-b-c.
 * @param use3D when true, includes the z axis (use with world landmarks) so the
 *   angle survives foreshortening — e.g. arm abduction seen from the front.
 */
export function calculateAngle(a: Point, b: Point, c: Point, use3D = false): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };

  if (use3D) {
    const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
    const magBA = Math.hypot(ba.x, ba.y, ba.z);
    const magBC = Math.hypot(bc.x, bc.y, bc.z);
    if (magBA === 0 || magBC === 0) return 0;
    const cos = Math.min(1, Math.max(-1, dot / (magBA * magBC)));
    return (Math.acos(cos) * 180) / Math.PI;
  }

  const radians = Math.atan2(bc.y, bc.x) - Math.atan2(ba.y, ba.x);
  let deg = Math.abs((radians * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

/**
 * Tilt (degrees) of the bottom→top segment away from vertical: 0° = perfectly
 * upright, 90° = horizontal. Image y grows downward, so "top above bottom"
 * means top.y < bottom.y. Used for torso-lean checks on standing exercises.
 */
export function inclineFromVertical(top: Point, bottom: Point): number {
  const dx = Math.abs(top.x - bottom.x);
  const dy = bottom.y - top.y; // positive when top is above bottom
  return (Math.atan2(dx, Math.max(dy, 1e-6)) * 180) / Math.PI;
}

/**
 * True if all three landmarks are confidently visible.
 * Fail-closed: a missing visibility score is treated as 0 (not visible), so
 * occluded / off-frame joints stop the rep counter instead of logging phantoms.
 */
export function jointVisible(a?: Point, b?: Point, c?: Point, min = 0.5): boolean {
  return [a, b, c].every((p) => p != null && (p.visibility ?? 0) >= min);
}

/** Minimum visibility across a set of landmark indices (fail-closed to 0). */
export function minVisibility(lm: Point[], indices: number[]): number {
  let min = 1;
  for (const i of indices) min = Math.min(min, lm[i]?.visibility ?? 0);
  return min;
}

// left↔right MediaPipe landmark pairs (shoulders, elbows, wrists, hips, knees, ankles, heels, feet)
const MIRROR_PAIRS: Array<[number, number]> = [
  [11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];
const MIRROR: Record<number, number> = {};
for (const [l, r] of MIRROR_PAIRS) {
  MIRROR[l] = r;
  MIRROR[r] = l;
}

/** The same joint set on the opposite body side (unpaired joints map to themselves). */
export function mirrorJoints<T extends number[]>(joints: T): T {
  return joints.map((j) => MIRROR[j] ?? j) as T;
}
