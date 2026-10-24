const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Game {
  constructor(canvas, { winningScore = 7 } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.winningScore = winningScore;
    this.width = canvas.width;
    this.height = canvas.height;
    this.paddle = { width: 14, height: 100, speed: 440, inset: 32 };
    this.ball = { radius: 9, speed: 390, maxBounceAngle: Math.PI / 3 };
    this.goalPauseDuration = 1.25;
    this.mode = "single";
    this.reset();
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
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
  }

  restart() {
    this.reset();
    this.running = true;
  }

  togglePause() {
    if (!this.running || this.gameOver || this.pauseRemaining > 0) return this.paused;
    this.paused = !this.paused;
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
      if (this.pauseRemaining === 0 && !this.gameOver) this.running = true;
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
  }

  score(playerId) {
    this.scores[playerId] += 1;
    this.lastScorer = playerId;
    this.goalSequence += 1;
    if (this.scores[playerId] >= this.winningScore) {
      this.running = false;
      this.gameOver = true;
      this.winner = playerId;
      return;
    }
    this.serve(playerId === 1 ? 1 : -1);
    this.running = false;
    this.paused = false;
    this.pauseRemaining = this.goalPauseDuration;
  }

  draw() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#167343";
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawScoringZones(ctx);
    this.drawPitch(ctx);
    this.drawGoal(ctx, 0, "#64f4ff");
    this.drawGoal(ctx, this.width, "#ff64d8");
    this.drawGlowRect(ctx, this.paddles[1].x, this.paddles[1].y, "#64f4ff");
    this.drawGlowRect(ctx, this.paddles[2].x, this.paddles[2].y, "#ff64d8");
    this.drawSoccerBall(ctx);
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
    ctx.strokeStyle = "rgba(229, 255, 235, 0.72)";
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
    ctx.fillStyle = "#e5ffeb";
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
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#18252b";
    for (const angle of [0, Math.PI * 0.4, Math.PI * 0.8, Math.PI * 1.2, Math.PI * 1.6]) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  drawGlowRect(ctx, x, y, color) {
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, this.paddle.width, this.paddle.height);
    ctx.shadowBlur = 0;
  }
}
