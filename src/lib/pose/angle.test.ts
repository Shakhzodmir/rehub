import { describe, expect, it } from "vitest";
import { calculateAngle, inclineFromVertical, jointVisible, minVisibility, mirrorJoints } from "./angle";

describe("calculateAngle", () => {
  it("returns 180° for a straight line", () => {
    const a = { x: 0.5, y: 0.3 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.5, y: 0.7 };
    expect(calculateAngle(a, b, c)).toBeCloseTo(180, 0);
  });

  it("returns 90° for a right angle", () => {
    const a = { x: 0.7, y: 0.5 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.5, y: 0.7 };
    expect(calculateAngle(a, b, c)).toBeCloseTo(90, 0);
  });

  it("uses z when 3D is requested", () => {
    // the segment folds toward the camera: straight in 2D, 135° in 3D
    const a = { x: 0.5, y: 0.3, z: -0.2 };
    const b = { x: 0.5, y: 0.5, z: 0 };
    const c = { x: 0.5, y: 0.7, z: 0 };
    expect(calculateAngle(a, b, c, false)).toBeCloseTo(180, 0);
    expect(calculateAngle(a, b, c, true)).toBeCloseTo(135, 0);
  });
});

describe("inclineFromVertical", () => {
  it("is 0° when the segment is upright", () => {
    expect(inclineFromVertical({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.6 })).toBeCloseTo(0, 1);
  });

  it("is 45° for a diagonal segment", () => {
    expect(inclineFromVertical({ x: 0.4, y: 0.2 }, { x: 0.2, y: 0.4 })).toBeCloseTo(45, 0);
  });

  it("approaches 90° when the segment is horizontal", () => {
    expect(inclineFromVertical({ x: 0.8, y: 0.5 }, { x: 0.2, y: 0.5 })).toBeGreaterThan(89);
  });
});

describe("mirrorJoints", () => {
  it("mirrors a right-leg triplet to the left leg", () => {
    expect(mirrorJoints([24, 26, 28])).toEqual([23, 25, 27]);
  });

  it("mirrors a cross-body triplet index by index", () => {
    expect(mirrorJoints([24, 12, 16])).toEqual([23, 11, 15]);
  });

  it("leaves unpaired joints (nose etc.) in place", () => {
    expect(mirrorJoints([0, 24, 26])).toEqual([0, 23, 25]);
  });
});

describe("visibility helpers", () => {
  it("jointVisible fails closed on missing visibility", () => {
    expect(jointVisible({ x: 0, y: 0 }, { x: 0, y: 0, visibility: 0.9 }, { x: 0, y: 0, visibility: 0.9 })).toBe(false);
  });

  it("minVisibility returns the weakest joint", () => {
    const lm = [
      { x: 0, y: 0, visibility: 0.9 },
      { x: 0, y: 0, visibility: 0.3 },
      { x: 0, y: 0, visibility: 0.7 },
    ];
    expect(minVisibility(lm, [0, 1, 2])).toBeCloseTo(0.3);
  });
});
