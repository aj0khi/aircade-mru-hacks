const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Bowling {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.lane = { left: 120, right: 840, top: 34, bottom: 510 };
    this.reset();
  }

  reset() {
    this.frame = 1;
    this.roll = 1;
    this.score = 0;
    this.frameScores = [];
    this.aim = 0;
    this.throwPower = 0.86;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.ball = null;
    this.pins = this.createPins();
    this.message = "PRESS START";
  }

  createPins() {
    const pins = [];
    const center = this.width / 2;
    const rowSpacing = 30;
    const columnSpacing = 25;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column <= row; column += 1) {
        pins.push({
          x: center + (column - row / 2) * columnSpacing,
          y: this.lane.top + 82 + row * rowSpacing,
          standing: true,
        });
      }
    }
    return pins;
  }

  start() {
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
    this.message = "AIM AND THROW";
  }

  restart() {
    this.reset();
    this.running = true;
    this.message = "AIM AND THROW";
  }

  togglePause() {
    if (!this.running || this.gameOver || this.ball) return this.paused;
    this.paused = !this.paused;
    return this.paused;
  }

  setAimInput(horizontalValue) {
    const value = Number(horizontalValue);
    if (Number.isFinite(value)) this.aim = clamp(value, -1, 1);
  }

  setMotionInput(horizontalValue, forwardValue) {
    this.setAimInput(horizontalValue);
    const value = Number(forwardValue);
    if (Number.isFinite(value) && value > 0.72 && !this.ball) {
      this.throwBall(value);
    }
  }

  throwBall(power = this.throwPower) {
    if (!this.running || this.paused || this.gameOver || this.ball) return false;
    const normalizedPower = clamp(Number(power) || this.throwPower, 0.58, 1);
    this.throwPower = normalizedPower;
    this.ball = {
      x: this.width / 2 + this.aim * 170,
      y: this.lane.bottom - 42,
      targetX: this.width / 2 + this.aim * 170,
      speed: 270 + normalizedPower * 210,
      radius: 15,
      elapsed: 0,
    };
    this.message = "ROLLING";
    return true;
  }

  update(deltaSeconds) {
    if (!this.running || this.paused || this.gameOver || !this.ball) return;
    const delta = Math.min(deltaSeconds, 0.05);
    this.ball.elapsed += delta;
    this.ball.y -= this.ball.speed * delta;
    this.ball.x += (this.ball.targetX - this.ball.x) * Math.min(delta * 3.5, 1);
    if (this.ball.y <= this.lane.top + 92) {
      this.resolveRoll();
    }
  }

  resolveRoll() {
    const impact = this.ball.x;
    const power = this.throwPower;
    const hitWidth = 46 + power * 26;
    let knockedDown = 0;
    for (const pin of this.pins) {
      if (pin.standing && Math.abs(pin.x - impact) <= hitWidth) {
        pin.standing = false;
        knockedDown += 1;
      }
    }
    this.score += knockedDown;
    this.frameScores.push(knockedDown);
    this.ball = null;
    if (this.roll === 1 && knockedDown < 10) {
      this.roll = 2;
      this.message = `${knockedDown} DOWN — SECOND ROLL`;
    } else {
      this.finishFrame(knockedDown);
    }
  }

  finishFrame() {
    if (this.frame >= 10) {
      this.running = false;
      this.gameOver = true;
      this.message = `FINAL SCORE ${this.score}`;
      return;
    }
    this.frame += 1;
    this.roll = 1;
    this.pins = this.createPins();
    this.aim = 0;
    this.message = `FRAME ${this.frame} — AIM AND THROW`;
  }

  handleKey(code) {
    if (code === "ArrowLeft") this.setAimInput(this.aim - 0.08);
    if (code === "ArrowRight") this.setAimInput(this.aim + 0.08);
    if (code === "ArrowUp") this.throwPower = clamp(this.throwPower + 0.04, 0.58, 1);
    if (code === "ArrowDown") this.throwPower = clamp(this.throwPower - 0.04, 0.58, 1);
    if (code === "Space") this.throwBall();
  }

  draw() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground(ctx);
    this.drawLane(ctx);
    this.drawPins(ctx);
    if (this.ball) this.drawBall(ctx);
    else this.drawAimGuide(ctx);
  }

  drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, "#101915");
    gradient.addColorStop(1, "#1c2920");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawLane(ctx) {
    const { left, right, top, bottom } = this.lane;
    const gradient = ctx.createLinearGradient(left, 0, right, 0);
    gradient.addColorStop(0, "#b7834c");
    gradient.addColorStop(0.5, "#e8bd79");
    gradient.addColorStop(1, "#b7834c");
    ctx.fillStyle = gradient;
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.strokeStyle = "rgba(255, 247, 216, 0.38)";
    ctx.lineWidth = 3;
    ctx.strokeRect(left, top, right - left, bottom - top);
    ctx.fillStyle = "rgba(103, 65, 32, 0.28)";
    for (let index = 0; index < 3; index += 1) {
      ctx.fillRect(left + 140 + index * 190, top, 5, bottom - top);
    }
    ctx.strokeStyle = "rgba(77, 48, 27, 0.36)";
    ctx.lineWidth = 2;
    for (let index = 0; index < 4; index += 1) {
      const y = top + 92 + index * 30;
      ctx.beginPath();
      ctx.moveTo(left + 110, y);
      ctx.lineTo(right - 110, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#f3d39a";
    ctx.fillRect(left, bottom - 28, right - left, 28);
  }

  drawPins(ctx) {
    for (const pin of this.pins) {
      if (!pin.standing) continue;
      ctx.fillStyle = "#f8f7ed";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.ellipse(pin.x, pin.y, 9, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d84e52";
      ctx.fillRect(pin.x - 6, pin.y - 8, 12, 4);
      ctx.shadowBlur = 0;
    }
  }

  drawAimGuide(ctx) {
    const x = this.width / 2 + this.aim * 170;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(x, this.lane.bottom - 16);
    ctx.lineTo(x, this.lane.top + 118);
    ctx.stroke();
    ctx.setLineDash([]);
    this.drawBallAt(ctx, x, this.lane.bottom - 42);
  }

  drawBall(ctx) {
    this.drawBallAt(ctx, this.ball.x, this.ball.y);
  }

  drawBallAt(ctx, x, y) {
    const gradient = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, 18);
    gradient.addColorStop(0, "#6de6d0");
    gradient.addColorStop(1, "#147b66");
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#64f4ff";
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#10241e";
    for (const offset of [[-5, -4], [1, -6], [-1, 2]]) {
      ctx.beginPath();
      ctx.arc(x + offset[0], y + offset[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
