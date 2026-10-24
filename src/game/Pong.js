const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Game {
  constructor(canvas, { winningScore = 3 } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.winningScore = winningScore;
    this.width = canvas.width;
    this.height = canvas.height;
    this.paddle = { width: 14, height: 100, speed: 440, inset: 32 };
    this.ball = { radius: 9, speed: 390, maxBounceAngle: Math.PI / 3 };
    this.goalPauseDuration = 1.25;
    this.mode = "single";
    this.onEvent = null;
    this.reset();
  }

  emit(type, detail = {}) {
    this.onEvent?.(type, { ...detail, width: this.width, height: this.height });
  }

  reset() {
    this.scores = { 1: 0, 2: 0 };
    this.inputs = { 1: 0, 2: 0 };
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.winner = null;
    this.pauseRemaining = 0;
    this.goalSequence = 0;
    this.lastScorer = null;
    this.paddles = {
      1: { x: this.paddle.inset, y: this.height / 2 - this.paddle.height / 2 },
      2: {
        x: this.width - this.paddle.inset - this.paddle.width,
        y: this.height / 2 - this.paddle.height / 2,
      },
    };
    this.serve();
  }

  serve(direction = Math.random() > 0.5 ? 1 : -1) {
    const angle = (Math.random() - 0.5) * (Math.PI / 2);
    this.ballState = {
      x: this.width / 2,
      y: this.height / 2,
      vx: Math.cos(angle) * this.ball.speed * direction,
      vy: Math.sin(angle) * this.ball.speed,
    };
  }

  start() {
    const alreadyRunning = this.running && !this.gameOver;
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
    if (!alreadyRunning) {
      this.emit("start", { x: this.ballState.x, y: this.ballState.y });
    }
  }

  restart() {
    this.reset();
    this.running = true;
    this.emit("start", { x: this.ballState.x, y: this.ballState.y });
  }

  togglePause() {
    if (!this.running || this.gameOver || this.pauseRemaining > 0) return this.paused;
    this.paused = !this.paused;
    this.emit(this.paused ? "pause" : "resume");
    return this.paused;
  }

  setMode(mode) {
    this.mode = mode === "two-player" ? "two-player" : "single";
    this.reset();
  }

  setPaddleInput(playerId, verticalValue) {
    if (playerId !== 1 && playerId !== 2) return;
    const numericValue = Number(verticalValue);
    this.inputs[playerId] = Number.isFinite(numericValue) ? clamp(numericValue, -1, 1) : 0;
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
    if (this.pauseRemaining > 0) {
      this.pauseRemaining = Math.max(0, this.pauseRemaining - delta);
      if (this.pauseRemaining === 0 && !this.gameOver) {
        this.running = true;
        this.emit("serve", { x: this.ballState.x, y: this.ballState.y });
      }
      return;
    }
    if (!this.running || this.gameOver || this.paused) return;
    this.movePaddle(1, this.inputs[1], delta);
    if (this.mode === "two-player") {
      this.movePaddle(2, this.inputs[2], delta);
    } else {
      const target = this.ballState.y - (this.paddle.height / 2);
      const aiInput = clamp((target - this.paddles[2].y) / 80, -1, 1);
      this.movePaddle(2, aiInput, delta);
    }
    this.moveBall(delta);
  }

  movePaddle(playerId, input, delta) {
    const paddle = this.paddles[playerId];
    paddle.y = clamp(
      paddle.y + input * this.paddle.speed * delta,
      0,
      this.height - this.paddle.height,
    );
  }

  moveBall(delta) {
    const ball = this.ballState;
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    if (ball.y - this.ball.radius <= 0 || ball.y + this.ball.radius >= this.height) {
      ball.y = clamp(ball.y, this.ball.radius, this.height - this.ball.radius);
      ball.vy *= -1;
      this.emit("wall", { x: ball.x, y: ball.y });
    }

    const left = this.paddles[1];
    const right = this.paddles[2];
    if (ball.vx < 0 && this.intersects(ball, left)) {
      this.reflectFromPaddle(ball, left, 1);
    } else if (ball.vx > 0 && this.intersects(ball, right)) {
      this.reflectFromPaddle(ball, right, -1);
    }

    if (ball.x + this.ball.radius < 0) this.score(2);
    if (ball.x - this.ball.radius > this.width) this.score(1);
  }

  intersects(ball, paddle) {
    return (
      ball.x - this.ball.radius < paddle.x + this.paddle.width &&
      ball.x + this.ball.radius > paddle.x &&
      ball.y + this.ball.radius > paddle.y &&
      ball.y - this.ball.radius < paddle.y + this.paddle.height
    );
  }

  reflectFromPaddle(ball, paddle, direction) {
    const relativeHit = (ball.y - (paddle.y + this.paddle.height / 2)) / (this.paddle.height / 2);
    const angle = clamp(relativeHit, -1, 1) * this.ball.maxBounceAngle;
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.04, 760);
    ball.vx = Math.cos(angle) * speed * direction;
    ball.vy = Math.sin(angle) * speed;
    ball.x = direction === 1
      ? paddle.x + this.paddle.width + this.ball.radius
      : paddle.x - this.ball.radius;
    this.emit("paddle", {
      playerId: direction === 1 ? 1 : 2,
      speed,
      x: ball.x,
      y: ball.y,
    });
  }

  score(playerId) {
    this.scores[playerId] += 1;
    this.lastScorer = playerId;
    this.goalSequence += 1;
    if (this.scores[playerId] >= this.winningScore) {
      this.running = false;
      this.gameOver = true;
      this.winner = playerId;
      this.emit("win", { playerId, x: this.ballState.x, y: this.ballState.y });
      return;
    }
    this.emit("score", { playerId, x: this.ballState.x, y: this.ballState.y });
    this.serve(playerId === 1 ? 1 : -1);
    this.running = false;
    this.paused = false;
    this.pauseRemaining = this.goalPauseDuration;
  }

  draw() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(this.paddles[1].x, this.paddles[1].y, this.paddle.width, this.paddle.height);
    ctx.fillRect(this.paddles[2].x, this.paddles[2].y, this.paddle.width, this.paddle.height);
    ctx.setLineDash([12, 16]);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.stroke();
    ctx.setLineDash([]);
    this.drawCenterTally(ctx);
    this.drawSoccerBall(ctx);
  }

  drawCenterTally(ctx) {
    const center = this.width / 2;
    const top = 28;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 13px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("P1", center - 42, top);
    ctx.fillText("P2", center + 42, top);
    ctx.font = "900 30px Arial, sans-serif";
    ctx.fillText(String(this.scores[1]), center - 42, top + 31);
    ctx.fillText(String(this.scores[2]), center + 42, top + 31);
    ctx.font = "900 10px Arial, sans-serif";
    ctx.fillStyle = "#a8a8a8";
    ctx.fillText("SCORE", center, top + 31);
    ctx.restore();
  }

  drawNeonGrid(ctx) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(123, 77, 255, 0.18)";
    for (let x = 0; x <= this.width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      40,
      this.width / 2,
      this.height / 2,
      this.width * 0.7,
    );
    glow.addColorStop(0, "rgba(34, 216, 255, 0.08)");
    glow.addColorStop(0.55, "rgba(255, 63, 186, 0.025)");
    glow.addColorStop(1, "rgba(9, 8, 23, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  drawScoringZones(ctx) {
    const zoneWidth = 118;
    const leftZone = ctx.createLinearGradient(0, 0, zoneWidth, 0);
    leftZone.addColorStop(0, "rgba(100, 244, 255, 0.16)");
    leftZone.addColorStop(1, "rgba(100, 244, 255, 0)");
    ctx.fillStyle = leftZone;
    ctx.fillRect(0, 0, zoneWidth, this.height);

    const rightZone = ctx.createLinearGradient(this.width, 0, this.width - zoneWidth, 0);
    rightZone.addColorStop(0, "rgba(255, 100, 216, 0.16)");
    rightZone.addColorStop(1, "rgba(255, 100, 216, 0)");
    ctx.fillStyle = rightZone;
    ctx.fillRect(this.width - zoneWidth, 0, zoneWidth, this.height);

    const goalTop = this.height / 2 - 145;
    const goalHeight = 290;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(100, 244, 255, 0.28)";
    ctx.strokeRect(18, goalTop, 110, goalHeight);
    ctx.strokeStyle = "rgba(255, 100, 216, 0.28)";
    ctx.strokeRect(this.width - 128, goalTop, 110, goalHeight);
  }

  drawPitch(ctx) {
    ctx.strokeStyle = "rgba(216, 246, 255, 0.86)";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(18, 18, this.width - 36, this.height - 36);
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#d8f6ff";
    ctx.fill();
    ctx.strokeRect(18, this.height / 2 - 145, 110, 290);
    ctx.strokeRect(this.width - 128, this.height / 2 - 145, 110, 290);
    ctx.strokeRect(18, this.height / 2 - 72, 48, 144);
    ctx.strokeRect(this.width - 66, this.height / 2 - 72, 48, 144);
  }

  drawGoal(ctx, x, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.strokeRect(x === 0 ? 2 : this.width - 2, this.height / 2 - 72, x === 0 ? 30 : -30, 144);
    ctx.shadowBlur = 0;
  }

  drawSoccerBall(ctx) {
    const { x, y } = this.ballState;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
