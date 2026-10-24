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
    this.reset();
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
      return;
    }
    this.snake.unshift(nextHead);
    if (nextHead.x === this.food.x && nextHead.y === this.food.y) {
      this.score += 1;
      this.placeFood();
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
    ctx.fillStyle = "#101327";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = "rgba(123, 77, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let x = 1; x < this.columns; x += 1) {
      ctx.beginPath(); ctx.moveTo(x * cellWidth, 0); ctx.lineTo(x * cellWidth, this.canvas.height); ctx.stroke();
    }
    for (let y = 1; y < this.rows; y += 1) {
      ctx.beginPath(); ctx.moveTo(0, y * cellHeight); ctx.lineTo(this.canvas.width, y * cellHeight); ctx.stroke();
    }
    this.drawCell(ctx, this.food, cellWidth, cellHeight, "#ffe44a");
    this.snake.forEach((segment, index) => this.drawCell(ctx, segment, cellWidth, cellHeight, index === 0 ? "#22d8ff" : "#ff3fba"));
  }

  drawCell(ctx, cell, width, height, color) {
    ctx.fillStyle = color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.fillRect(cell.x * width + 3, cell.y * height + 3, width - 6, height - 6);
    ctx.shadowBlur = 0;
  }
}
