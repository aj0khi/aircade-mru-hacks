const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class BowlingMotionAdapter {
  constructor(game, { swingThreshold = 0.68, releaseThreshold = 0.28 } = {}) {
    this.game = game;
    this.swingThreshold = swingThreshold;
    this.releaseThreshold = releaseThreshold;
    this.forward = 0;
    this.horizontal = 0;
    this.swingArmed = true;
    this.lastTimestamp = 0;
  }

  calibrate({ horizontal = 0, forward = 0 } = {}) {
    this.horizontalNeutral = Number.isFinite(Number(horizontal)) ? Number(horizontal) : 0;
    this.forwardNeutral = Number.isFinite(Number(forward)) ? Number(forward) : 0;
  }

  setSample({ horizontal = 0, forward = 0, timestamp = performance.now() } = {}) {
    const rawHorizontal = Number(horizontal) - (this.horizontalNeutral ?? 0);
    const rawForward = Number(forward) - (this.forwardNeutral ?? 0);
    if (!Number.isFinite(rawHorizontal) || !Number.isFinite(rawForward)) return false;

    const elapsed = this.lastTimestamp > 0 ? Math.max(timestamp - this.lastTimestamp, 1) : 16;
    const smoothing = clamp(elapsed / 90, 0.08, 0.5);
    this.horizontal += (clamp(rawHorizontal, -1, 1) - this.horizontal) * smoothing;
    this.forward += (clamp(rawForward, -1, 1) - this.forward) * smoothing;
    this.lastTimestamp = timestamp;
    this.game.setAimInput(this.horizontal);

    if (this.forward <= this.releaseThreshold) this.swingArmed = true;
    if (this.swingArmed && this.forward >= this.swingThreshold) {
      this.swingArmed = false;
      return this.game.throwBall(this.forward);
    }
    return false;
  }

  reset() {
    this.forward = 0;
    this.horizontal = 0;
    this.swingArmed = true;
    this.lastTimestamp = 0;
  }
}
