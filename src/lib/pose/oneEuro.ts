// One Euro filter — adaptive low-pass smoothing for a noisy scalar signal
// (here: a joint angle stream from MediaPipe). It trades latency for jitter
// dynamically: slow movements are smoothed hard, fast movements pass through.
// Reference: Casiez, Roussel & Vogel, "1€ Filter" (CHI 2012).

class LowPassFilter {
  private smoothed: number | null = null;

  filter(value: number, alpha: number): number {
    this.smoothed =
      this.smoothed === null ? value : alpha * value + (1 - alpha) * this.smoothed;
    return this.smoothed;
  }

  last(): number | null {
    return this.smoothed;
  }

  reset() {
    this.smoothed = null;
  }
}

export class OneEuroFilter {
  private x = new LowPassFilter();
  private dx = new LowPassFilter();
  private lastTimeMs: number | null = null;

  /**
   * @param minCutoff lower → smoother but laggier at rest (~1.0 Hz for 30fps angles)
   * @param beta      higher → snappier on fast motion (~0.05 works for rep angles)
   * @param dCutoff   cutoff for the derivative estimate
   */
  constructor(
    private minCutoff = 1.0,
    private beta = 0.05,
    private dCutoff = 1.0
  ) {}

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, timestampMs: number): number {
    if (this.lastTimeMs === null) {
      this.lastTimeMs = timestampMs;
      return this.x.filter(value, 1);
    }

    let dt = (timestampMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = timestampMs;
    if (!(dt > 0)) dt = 1 / 30; // guard against zero / out-of-order timestamps

    const prev = this.x.last() ?? value;
    const derivative = (value - prev) / dt;
    const edx = this.dx.filter(derivative, this.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, this.alpha(cutoff, dt));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastTimeMs = null;
  }
}

interface SmoothablePoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Per-landmark One Euro smoothing for the drawn skeleton only — the rep-counting
 * path keeps its own scalar angle filter untouched. Position filters are tuned
 * snappier than the angle filter (higher beta) so fast limbs don't trail.
 * z / visibility pass through unfiltered (z is only used for point radius).
 */
export class LandmarkSmoother {
  private filters: Array<{ x: OneEuroFilter; y: OneEuroFilter }> = [];

  smooth<T extends SmoothablePoint>(landmarks: T[], timestampMs: number): T[] {
    while (this.filters.length < landmarks.length) {
      this.filters.push({
        x: new OneEuroFilter(1.5, 0.5),
        y: new OneEuroFilter(1.5, 0.5),
      });
    }
    return landmarks.map((p, i) => ({
      ...p,
      x: this.filters[i].x.filter(p.x, timestampMs),
      y: this.filters[i].y.filter(p.y, timestampMs),
    }));
  }

  reset() {
    for (const f of this.filters) {
      f.x.reset();
      f.y.reset();
    }
  }
}
