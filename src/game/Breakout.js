const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** 5×7 uppercase block-letter bitmaps (1 = brick, 0 = empty). */
const LETTER_PATTERNS = {
  A: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  I: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  R: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  C: [
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
  ],
  D: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  E: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
};

const LETTER_COLS = 5;
const LETTER_ROWS = 7;

/** Per-letter colors for the AIR / CADE layout (exact hex required). */
const LINE_LETTER_COLORS = [
  ["#E44B3A", "#F2C94C", "#4B8BC5"], // A I R
  ["#EF8C3A", "#F2C94C", "#66A64A", "#4B8BC5"], // C A D E
];

export class Breakout {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.paddle = { width: 132, height: 14, speed: 620 };
    this.onEvent = null;
    this.reset();
  }

  emit(type, detail = {}) {
    this.onEvent?.(type, { ...detail, width: this.width, height: this.height });
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

  letterPixelWidth(brickWidth, gapX) {
    return LETTER_COLS * brickWidth + (LETTER_COLS - 1) * gapX;
  }

  wordPixelWidth(letterCount, brickWidth, gapX, letterGap) {
    if (letterCount <= 0) return 0;
    const letterWidth = this.letterPixelWidth(brickWidth, gapX);
    return letterCount * letterWidth + (letterCount - 1) * letterGap;
  }

  appendLetterBricks(bricks, letter, originX, originY, brickWidth, brickHeight, gapX, gapY, color, row) {
    const pattern = LETTER_PATTERNS[letter];
    if (!pattern) return;
    for (let rowIndex = 0; rowIndex < LETTER_ROWS; rowIndex += 1) {
      for (let colIndex = 0; colIndex < LETTER_COLS; colIndex += 1) {
        if (!pattern[rowIndex][colIndex]) continue;
        bricks.push({
          x: originX + colIndex * (brickWidth + gapX),
          y: originY + rowIndex * (brickHeight + gapY),
          width: brickWidth,
          height: brickHeight,
          row,
          color,
          visible: true,
        });
      }
    }
  }

  createBricks() {
    const bricks = [];
    const lines = ["AIR", "CADE"];
    const marginX = Math.max(24, this.width * 0.04);
    const availableWidth = this.width - marginX * 2;
    const maxLineLetters = Math.max(...lines.map((line) => line.length));
    const letterGap = Math.max(70, Math.round(this.width * 0.032));
    const gapX = 2;
    const gapY = 2;

    // Fit brick size so the longest line (CADE) stays inside the canvas.
    let brickWidth = 14;
    while (
      brickWidth > 10
      && this.wordPixelWidth(maxLineLetters, brickWidth, gapX, letterGap) > availableWidth
    ) {
      brickWidth -= 1;
    }
    const brickHeight = clamp(Math.round(brickWidth * 0.85), 9, 12);
    const letterHeight = LETTER_ROWS * brickHeight + (LETTER_ROWS - 1) * gapY;
    const lineGap = Math.max(18, Math.round(brickHeight * 2.2));
    // Keep letters in the upper playfield, clear of the paddle.
    const topY = Math.max(40, Math.round(this.height * 0.08));

    lines.forEach((word, lineIndex) => {
      const colors = LINE_LETTER_COLORS[lineIndex];
      const wordWidth = this.wordPixelWidth(word.length, brickWidth, gapX, letterGap);
      const startX = Math.round((this.width - wordWidth) / 2);
      const startY = topY + lineIndex * (letterHeight + lineGap);
      const letterWidth = this.letterPixelWidth(brickWidth, gapX);

      for (let letterIndex = 0; letterIndex < word.length; letterIndex += 1) {
        const letter = word[letterIndex];
        const originX = startX + letterIndex * (letterWidth + letterGap);
        this.appendLetterBricks(
          bricks,
          letter,
          originX,
          startY,
          brickWidth,
          brickHeight,
          gapX,
          gapY,
          colors[letterIndex],
          lineIndex,
        );
      }
    });

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
    const alreadyRunning = this.running && !this.gameOver;
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
    if (!alreadyRunning) {
      this.emit("start", { x: this.ball.x, y: this.ball.y });
    }
  }

  restart() {
    this.reset();
    this.running = true;
    this.emit("start", { x: this.ball.x, y: this.ball.y });
  }

  togglePause() {
    if (!this.running || this.gameOver) return this.paused;
    this.paused = !this.paused;
    this.emit(this.paused ? "pause" : "resume");
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
      this.emit("wall", { x: ball.x, y: ball.y });
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
      this.emit("wall", { x: ball.x, y: ball.y });
    }
    const paddle = this.paddleState;
    if (ball.vy > 0 && this.intersects(ball, paddle.x, paddle.y, this.paddle.width, this.paddle.height)) {
      const hit = (ball.x - (paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
      ball.y = paddle.y - ball.radius;
      ball.vx = clamp(hit, -1, 1) * 430;
      ball.vy = -Math.max(290, Math.abs(ball.vy) * 1.02);
      this.emit("paddle", { x: ball.x, y: ball.y, hit: clamp(hit, -1, 1) });
    }
    for (const brick of this.bricks) {
      if (!brick.visible || !this.intersects(ball, brick.x, brick.y, brick.width, brick.height)) continue;
      brick.visible = false;
      this.score += 10;
      ball.vy *= -1;
      this.emit("brick", {
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height / 2,
        row: brick.row ?? 0,
        score: this.score,
      });
      break;
    }
    if (this.bricks.every((brick) => !brick.visible)) {
      this.running = false;
      this.gameOver = true;
      this.emit("win", { x: ball.x, y: ball.y, score: this.score });
      return;
    }
    if (ball.y - ball.radius > this.height) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.running = false;
        this.gameOver = true;
        this.emit("die", { x: ball.x, y: ball.y });
      } else {
        this.running = false;
        this.serve();
        this.emit("lose-life", { x: ball.x, y: ball.y, lives: this.lives });
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
    ctx.fillStyle = "#070707";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
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
    this.drawBallsLeft(ctx);
    this.drawGlowRect(ctx, this.paddleState.x, this.paddleState.y, this.paddle.width, this.paddle.height, "#f5f1df");
    this.drawBall(ctx);
  }

  drawBallsLeft(ctx) {
    const startX = this.width - 142;
    const y = 24;
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "900 11px Tahoma, sans-serif";
    ctx.fillStyle = "#f7f3ff";
    ctx.fillText("BALLS", startX, y + 2);
    for (let index = 0; index < 3; index += 1) {
      const x = startX + 52 + index * 20;
      const available = index < this.lives;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = available ? "#f7f3ff" : "rgba(247, 243, 255, 0.2)";
      ctx.fill();
      ctx.strokeStyle = available ? "#22d8ff" : "rgba(247, 243, 255, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.font = "900 11px Tahoma, sans-serif";
    ctx.fillStyle = "#22d8ff";
    ctx.fillText(`x${this.lives}`, startX + 118, y + 2);
    ctx.restore();
  }

  drawGlowRect(ctx, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  drawBall(ctx) {
    ctx.fillStyle = "#f7f3ff";
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
