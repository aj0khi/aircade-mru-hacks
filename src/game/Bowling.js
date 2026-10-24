const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Bowling {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.lastSwing = 0;
    this.pointerStart = null;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerStart = { x: event.offsetX, y: event.offsetY };
      this.updateAimFromPointer(event.offsetX);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (this.pointerStart) this.updateAimFromPointer(event.offsetX);
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!this.pointerStart) return;
      const drag = this.pointerStart.y - event.offsetY;
      this.updateAimFromPointer(event.offsetX);
      if (drag > 20) this.throwBall(clamp(drag / 180, 0.35, 1));
      this.pointerStart = null;
    });
    this.reset();
  }

  reset() {
    this.score = 0;
    this.frame = 1;
    this.rolls = 0;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.aim = 0;
    this.power = 0;
    this.ball = null;
    this.pins = this.createPins();
    this.message = "PRESS START";
  }

  createPins() {
    return Array.from({ length: 10 }, (_, index) => {
      const row = Math.floor((index + 1) / 3.01);
      const column = (index + 1) % 3;
      return { x: (column - 1) * (row + 1) * 0.18, row, standing: true };
    });
  }

  start() {
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
    this.message = "AIM THE LANE";
  }

  restart() {
    this.reset();
    this.start();
  }

  togglePause() {
    if (!this.running || this.gameOver || this.ball) return this.paused;
    this.paused = !this.paused;
    this.message = this.paused ? "PAUSED" : "AIM THE LANE";
    return this.paused;
  }

  setAimInput(value) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) this.aim = clamp(numericValue, -1, 1);
  }

  updateAimFromPointer(pointerX) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    this.setAimInput(((pointerX * scaleX) / this.width - 0.5) * 2);
  }

  setMotionInput(rollValue, swingValue) {
    this.setAimInput(rollValue);
    const swing = clamp(Number(swingValue) || 0, -1, 1);
    if (swing > 0.62 && this.lastSwing <= 0.62) this.throwBall(swing);
    this.lastSwing = swing;
  }

  throwBall(power = 0.9) {
    if (!this.running || this.paused || this.gameOver || this.ball) return;
    this.power = clamp(power, 0.25, 1);
    this.ball = { progress: 0, laneX: this.aim, speed: 0.52 + this.power * 0.28 };
    this.message = "ROLLING";
  }

  handleKey(code) {
    if (code === "ArrowLeft") this.setAimInput(this.aim - 0.08);
    if (code === "ArrowRight") this.setAimInput(this.aim + 0.08);
    if (code === "Space") this.throwBall();
  }

  update(deltaSeconds) {
    if (!this.running || this.paused || this.gameOver || !this.ball) return;
    this.ball.progress += Math.min(deltaSeconds, 0.05) * this.ball.speed;
    if (this.ball.progress >= 1) this.finishRoll();
  }

  finishRoll() {
    const accuracy = Math.abs(this.ball.laneX);
    const hitCount = accuracy < 0.16 ? 10 : accuracy < 0.34 ? 6 : accuracy < 0.58 ? 3 : 1;
    const standing = this.pins.filter((pin) => pin.standing);
    standing.slice(0, hitCount).forEach((pin) => { pin.standing = false; });
    this.score += hitCount;
    this.rolls += 1;
    this.ball = null;
    if (this.rolls >= 2 || this.pins.every((pin) => !pin.standing)) {
      this.frame += 1;
      this.rolls = 0;
      if (this.frame > 10) {
        this.running = false;
        this.gameOver = true;
        this.message = `GAME OVER · ${this.score} PINS`;
        return;
      }
      this.pins = this.createPins();
      this.message = "NEW FRAME";
    } else {
      this.message = "SECOND ROLL";
    }
  }

  lanePoint(progress, laneX = 0) {
    const near = { x: this.width / 2 + laneX * 220, y: this.height - 72 };
    const far = { x: this.width / 2 + laneX * 54, y: 112 };
    return {
      x: near.x + (far.x - near.x) * progress,
      y: near.y + (far.y - near.y) * progress,
    };
  }

  draw() {
    const ctx = this.context;
    ctx.fillStyle = "#080a18";
    ctx.fillRect(0, 0, this.width, this.height);
    const lane = ctx.createLinearGradient(0, 70, 0, this.height);
    lane.addColorStop(0, "#3a2460");
    lane.addColorStop(0.45, "#151d46");
    lane.addColorStop(1, "#08152a");
    ctx.fillStyle = lane;
    ctx.beginPath();
    ctx.moveTo(330, 92); ctx.lineTo(630, 92); ctx.lineTo(850, 540); ctx.lineTo(110, 540);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(100, 244, 255, 0.34)";
    ctx.lineWidth = 3;
    ctx.stroke();
    this.drawLaneMarks(ctx);
    this.drawPins(ctx);
    this.drawAim(ctx);
    if (this.ball) this.drawBall(ctx);
    ctx.fillStyle = "#ffe44a";
    ctx.font = "900 18px Arial";
    ctx.fillText(`FRAME ${Math.min(this.frame, 10)}  ·  ${this.score} PINS`, 34, 42);
    ctx.fillStyle = "#22d8ff";
    ctx.font = "700 14px Arial";
    ctx.fillText(this.message, 34, 66);
  }

  drawLaneMarks(ctx) {
    ctx.strokeStyle = "rgba(255, 228, 74, 0.22)";
    ctx.lineWidth = 2;
    for (let index = 1; index < 7; index += 1) {
      const x = 330 + index * 50;
      ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(130 + index * 100, 540); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    for (let index = 1; index < 5; index += 1) {
      const y = 120 + index * 85;
      ctx.beginPath(); ctx.moveTo(330 - index * 12, y); ctx.lineTo(630 + index * 12, y); ctx.stroke();
    }
  }

  drawPins(ctx) {
    for (const pin of this.pins) {
      if (!pin.standing) continue;
      const point = this.lanePoint(0.77 + pin.row * 0.025, pin.x);
      const size = 10 + pin.row;
      ctx.fillStyle = "#f7f3ff";
      ctx.beginPath(); ctx.arc(point.x, point.y, size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff3fba";
      ctx.fillRect(point.x - size * 0.75, point.y - 2, size * 1.5, 4);
    }
  }

  drawAim(ctx) {
    const point = this.lanePoint(0, this.aim);
    ctx.strokeStyle = "#ffe44a";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(this.width / 2, 106); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawBall(ctx) {
    const point = this.lanePoint(this.ball.progress, this.ball.laneX);
    const radius = 18 - this.ball.progress * 10;
    ctx.shadowColor = "#22d8ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#22d8ff";
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#08152a";
    ctx.beginPath(); ctx.arc(point.x - radius * 0.25, point.y - radius * 0.2, radius * 0.18, 0, Math.PI * 2); ctx.fill();
  }
}
