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
 * True if all three landmarks are confidently visible.
 * Fail-closed: a missing visibility score is treated as 0 (not visible), so
 * occluded / off-frame joints stop the rep counter instead of logging phantoms.
 */
export function jointVisible(a?: Point, b?: Point, c?: Point, min = 0.5): boolean {
  return [a, b, c].every((p) => p != null && (p.visibility ?? 0) >= min);
}
