const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export class Snake {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.columns = 24;
    this.rows = 14;
    this.stepDuration = 0.12;
    this.onEvent = null;
    this.reset();
  }

  emit(type, detail = {}) {
    this.onEvent?.(type, { ...detail, columns: this.columns, rows: this.rows });
  }

  reset() {
    this.snake = [{ x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.food = { x: 17, y: 7 };
    this.score = 0;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.elapsed = 0;
  }

  start() {
    const alreadyRunning = this.running && !this.gameOver;
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
    if (!alreadyRunning) {
      const head = this.snake[0];
      this.emit("start", { x: head.x, y: head.y });
    }
  }

  restart() {
    this.reset();
    this.running = true;
    const head = this.snake[0];
    this.emit("start", { x: head.x, y: head.y });
  }

  togglePause() {
    if (!this.running || this.gameOver) return this.paused;
    this.paused = !this.paused;
    this.emit(this.paused ? "pause" : "resume");
    return this.paused;
  }

  handleKey(code) {
    const next = DIRECTIONS[code];
    if (!next || (next.x === -this.direction.x && next.y === -this.direction.y)) return;
    this.nextDirection = next;
  }

  update(deltaSeconds) {
    if (!this.running || this.paused || this.gameOver) return;
    this.elapsed += Math.min(deltaSeconds, 0.05);
    while (this.elapsed >= this.stepDuration) {
      this.elapsed -= this.stepDuration;
      this.step();
    }
  }

  step() {
    this.direction = this.nextDirection;
    const head = this.snake[0];
    const nextHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };
    const hitWall = nextHead.x < 0 || nextHead.x >= this.columns || nextHead.y < 0 || nextHead.y >= this.rows;
    const hitSelf = this.snake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
    if (hitWall || hitSelf) {
      this.running = false;
      this.gameOver = true;
      this.emit("die", {
        x: nextHead.x,
        y: nextHead.y,
        hit: hitWall ? "wall" : "self",
      });
      return;
    }
    this.snake.unshift(nextHead);
    if (nextHead.x === this.food.x && nextHead.y === this.food.y) {
      this.score += 1;
      this.placeFood();
      this.emit("eat", { score: this.score, x: nextHead.x, y: nextHead.y });
    } else {
      this.snake.pop();
    }
  }

  placeFood() {
    const open = [];
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        if (!this.snake.some((segment) => segment.x === x && segment.y === y)) open.push({ x, y });
      }
    }
    this.food = open[Math.floor(Math.random() * open.length)] ?? this.food;
  }

  draw() {
    const ctx = this.context;
    const cellWidth = this.canvas.width / this.columns;
    const cellHeight = this.canvas.height / this.rows;
    ctx.fillStyle = "#f5f1df";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = "rgba(45, 91, 51, 0.13)";
    ctx.lineWidth = 1;
    for (let x = 1; x < this.columns; x += 1) {
      ctx.beginPath(); ctx.moveTo(x * cellWidth, 0); ctx.lineTo(x * cellWidth, this.canvas.height); ctx.stroke();
    }
    for (let y = 1; y < this.rows; y += 1) {
      ctx.beginPath(); ctx.moveTo(0, y * cellHeight); ctx.lineTo(this.canvas.width, y * cellHeight); ctx.stroke();
    }
    ctx.strokeStyle = "#315b35";
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(11, 11, this.canvas.width - 22, this.canvas.height - 22);
    this.drawApple(ctx, this.food, cellWidth, cellHeight);
    for (let index = this.snake.length - 1; index >= 0; index -= 1) {
      this.drawSnakeSegment(ctx, this.snake[index], cellWidth, cellHeight, index === 0);
    }
  }

  drawSnakeSegment(ctx, segment, width, height, head) {
    const x = segment.x * width + width / 2;
    const y = segment.y * height + height / 2;
    const inset = head ? 3 : 5;
    const size = Math.min(width, height) - inset * 2;
    const left = x - size / 2;
    const top = y - size / 2;
    ctx.save();
    ctx.shadowColor = "rgba(28, 72, 32, 0.28)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = head ? "#2f7d32" : "#4b9d45";
    this.roundedRect(ctx, left, top, size, size, head ? 10 : 7);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = head ? "#204d27" : "#39783b";
    ctx.lineWidth = 2;
    this.roundedRect(ctx, left + 1, top + 1, size - 2, size - 2, head ? 9 : 6);
    ctx.stroke();
    if (head) {
      const forwardX = this.direction.x * width * 0.17;
      const forwardY = this.direction.y * height * 0.17;
      const sideX = this.direction.y * width * 0.15;
      const sideY = -this.direction.x * height * 0.15;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x + forwardX + sideX, y + forwardY + sideY, 4, 0, Math.PI * 2);
      ctx.arc(x + forwardX - sideX, y + forwardY - sideY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(x + forwardX + sideX + forwardX * 0.15, y + forwardY + sideY + forwardY * 0.15, 1.8, 0, Math.PI * 2);
      ctx.arc(x + forwardX - sideX + forwardX * 0.15, y + forwardY - sideY + forwardY * 0.15, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d94b3d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + forwardX * 1.8, y + forwardY * 1.8);
      ctx.lineTo(x + forwardX * 2.5, y + forwardY * 2.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  drawApple(ctx, food, width, height) {
    const x = food.x * width + width / 2;
    const y = food.y * height + height / 2 + 2;
    ctx.save();
    ctx.shadowColor = "rgba(134, 40, 31, 0.32)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#d94b3d";
    ctx.beginPath();
    ctx.arc(x - 5, y, 9, 0, Math.PI * 2);
    ctx.arc(x + 5, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#4b7135";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 3, y - 15);
    ctx.stroke();
    ctx.fillStyle = "#5a8d3e";
    ctx.beginPath();
    ctx.ellipse(x + 7, y - 13, 6, 3, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
