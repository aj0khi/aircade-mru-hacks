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
    ctx.fillStyle = "#f5f1df";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = "rgba(38, 92, 43, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 1; x < this.columns; x += 1) {
      ctx.beginPath(); ctx.moveTo(x * cellWidth, 0); ctx.lineTo(x * cellWidth, this.canvas.height); ctx.stroke();
    }
    for (let y = 1; y < this.rows; y += 1) {
      ctx.beginPath(); ctx.moveTo(0, y * cellHeight); ctx.lineTo(this.canvas.width, y * cellHeight); ctx.stroke();
    }
    this.drawApple(ctx, this.food, cellWidth, cellHeight);
    this.snake.forEach((segment, index) => this.drawSnakeSegment(ctx, segment, cellWidth, cellHeight, index === 0));
  }

  drawSnakeSegment(ctx, segment, width, height, head) {
    const x = segment.x * width + width / 2;
    const y = segment.y * height + height / 2;
    const radius = Math.min(width, height) * (head ? 0.42 : 0.38);
    ctx.fillStyle = head ? "#2f7d32" : "#4b9d45";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (head) {
      const eyeOffset = this.direction.x === 0 ? width * 0.18 : 0;
      const eyeX = x + (this.direction.x * width * 0.18);
      const eyeY = y + (this.direction.y * height * 0.18);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(eyeX - eyeOffset, eyeY - (this.direction.x === 0 ? height * 0.13 : width * 0.13), 3, 0, Math.PI * 2);
      ctx.arc(eyeX + eyeOffset, eyeY + (this.direction.x === 0 ? height * 0.13 : width * 0.13), 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(eyeX - eyeOffset, eyeY - (this.direction.x === 0 ? height * 0.13 : width * 0.13), 1.5, 0, Math.PI * 2);
      ctx.arc(eyeX + eyeOffset, eyeY + (this.direction.x === 0 ? height * 0.13 : width * 0.13), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawApple(ctx, food, width, height) {
    const x = food.x * width + width / 2;
    const y = food.y * height + height / 2 + 2;
    ctx.fillStyle = "#d94b3d";
    ctx.beginPath();
    ctx.arc(x - 5, y, 8, 0, Math.PI * 2);
    ctx.arc(x + 5, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4b7135";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 3, y - 15);
    ctx.stroke();
  }
}
