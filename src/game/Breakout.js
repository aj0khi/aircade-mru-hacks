const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BRICK_COLORS = ["#22d8ff", "#ff3fba", "#ffe44a", "#7b4dff"];

export class Breakout {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.paddle = { width: 132, height: 14, speed: 620 };
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.inputs = 0;
    this.bricks = this.createBricks();
    this.paddleState = { x: this.width / 2 - this.paddle.width / 2, y: this.height - 42 };
    this.serve();
  }

  createBricks() {
    const bricks = [];
    const columns = 10;
    const rows = 5;
    const gap = 8;
    const width = (this.width - 96 - gap * (columns - 1)) / columns;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        bricks.push({
          x: 48 + column * (width + gap),
          y: 56 + row * 28,
          width,
          height: 18,
          color: BRICK_COLORS[row % BRICK_COLORS.length],
          visible: true,
        });
      }
    }
    return bricks;
  }

  serve() {
    this.ball = {
      x: this.width / 2,
      y: this.height - 70,
      radius: 8,
      vx: (Math.random() > 0.5 ? 1 : -1) * 230,
      vy: -310,
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
    if (!this.running || this.gameOver) return this.paused;
    this.paused = !this.paused;
    return this.paused;
  }

  setPaddleInput(value) {
    const numericValue = Number(value);
    this.inputs = Number.isFinite(numericValue) ? clamp(numericValue, -1, 1) : 0;
  }

  movePaddle(delta) {
    this.paddleState.x = clamp(
      this.paddleState.x + this.inputs * this.paddle.speed * delta,
      18,
      this.width - this.paddle.width - 18,
    );
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
    if (!this.running || this.paused || this.gameOver) return;
    this.movePaddle(delta);
    const ball = this.ball;
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;
    if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= this.width) {
      ball.x = clamp(ball.x, ball.radius, this.width - ball.radius);
      ball.vx *= -1;
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }
    const paddle = this.paddleState;
    if (ball.vy > 0 && this.intersects(ball, paddle.x, paddle.y, this.paddle.width, this.paddle.height)) {
      const hit = (ball.x - (paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
      ball.y = paddle.y - ball.radius;
      ball.vx = clamp(hit, -1, 1) * 430;
      ball.vy = -Math.max(290, Math.abs(ball.vy) * 1.02);
    }
    for (const brick of this.bricks) {
      if (!brick.visible || !this.intersects(ball, brick.x, brick.y, brick.width, brick.height)) continue;
      brick.visible = false;
      this.score += 10;
      ball.vy *= -1;
      break;
    }
    if (this.bricks.every((brick) => !brick.visible)) {
      this.running = false;
      this.gameOver = true;
      return;
    }
    if (ball.y - ball.radius > this.height) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.running = false;
        this.gameOver = true;
      } else {
        this.running = false;
        this.serve();
      }
    }
  }

  intersects(ball, x, y, width, height) {
    return ball.x + ball.radius > x
      && ball.x - ball.radius < x + width
      && ball.y + ball.radius > y
      && ball.y - ball.radius < y + height;
  }

  draw() {
    const ctx = this.context;
    ctx.fillStyle = "#0b0920";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(123, 77, 255, 0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.width; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
    }
    for (const brick of this.bricks) {
      if (brick.visible) this.drawGlowRect(ctx, brick.x, brick.y, brick.width, brick.height, brick.color);
    }
    this.drawGlowRect(ctx, this.paddleState.x, this.paddleState.y, this.paddle.width, this.paddle.height, "#22d8ff");
    this.drawBall(ctx);
  }

  drawGlowRect(ctx, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.fillRect(x, y, width, height);
    ctx.shadowBlur = 0;
  }

  drawBall(ctx) {
    ctx.fillStyle = "#f7f3ff";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ffe44a";
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
