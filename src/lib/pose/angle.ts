export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Angle (degrees) at vertex b formed by a-b-c. */
export function calculateAngle(a: Point, b: Point, c: Point): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((radians * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

/** True if all three landmarks are confidently visible. */
export function jointVisible(a?: Point, b?: Point, c?: Point, min = 0.5): boolean {
  return [a, b, c].every((p) => p && (p.visibility ?? 1) >= min);
}
