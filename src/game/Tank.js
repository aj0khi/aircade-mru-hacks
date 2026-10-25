// Tank Arena — grid-based arcade game (24×14, matching Snake).
// Same public lifecycle methods as Game.js and Snake.js.
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const COLS = 24;
const ROWS = 14;
const TAU = Math.PI * 2;

const BULLET_SPEED = 390;
const FIRE_COOLDOWN = 0.65;
const BULLET_LIFE = 4.5;
const MOVE_COOLDOWN = 0.2;
const MOTION_THRESHOLD = 0.36;
const MOTION_NEUTRAL = 0.22;

// 0 right, 1 down, 2 left, 3 up — 90° steps only.
const FACING = [
  { x: 1, y: 0, rotation: 0 },
  { x: 0, y: 1, rotation: Math.PI / 2 },
  { x: -1, y: 0, rotation: Math.PI },
  { x: 0, y: -1, rotation: -Math.PI / 2 },
];

const P1_KEYS = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  fire: "Space",
};
const P2_KEYS = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  fire: "KeyF",
};

const P1_SPAWN = { col: 3, row: 6, facing: 0 };
const P2_SPAWN = { col: 20, row: 6, facing: 2 };

function cellWidth() {
  return WORLD_WIDTH / COLS;
}

function cellHeight() {
  return WORLD_HEIGHT / ROWS;
}

function cellCenter(col, row) {
  return {
    x: (col + 0.5) * cellWidth(),
    y: (row + 0.5) * cellHeight(),
  };
}

function cellRect(col, row) {
  return {
    x: col * cellWidth(),
    y: row * cellHeight(),
    w: cellWidth(),
    h: cellHeight(),
  };
}

function makeWalls() {
  const cells = new Map();
  const put = (col, row, breakable = false) => {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return;
    if (col === P1_SPAWN.col && row === P1_SPAWN.row) return;
    if (col === P2_SPAWN.col && row === P2_SPAWN.row) return;
    cells.set(`${col},${row}`, {
      col,
      row,
      breakable,
      hp: breakable ? 3 : Infinity,
    });
  };

  // 24×14. # steel, B brick, . empty. Outer 3 columns on each side are steel.
  const MAP = [
    "###..##..BB....BB.##.###",
    "###.##.BB.##.BB.##...###",
    "###.##....##....##...###",
    "###....##....##......###",
    "###BB.####..####.BB..###",
    "###.##..........##...###",
    "###1.....##.##......2###",
    "###.##..........##...###",
    "###BB.####..####.BB..###",
    "###....##....##......###",
    "###.##....##....##...###",
    "###.##.BB.##.BB.##...###",
    "###..##..BB....BB.##.###",
    "###......####........###",
  ];

  for (let row = 0; row < MAP.length; row++) {
    const line = MAP[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === "#") put(col, row, false);
      else if (ch === "B") put(col, row, true);
    }
  }

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < 3; col++) put(col, row, false);
    for (let col = COLS - 3; col < COLS; col++) put(col, row, false);
  }

  return [...cells.values()];
}

function circleHitsRect(x, y, radius, wall) {
  const nearestX = clamp(x, wall.x, wall.x + wall.w);
  const nearestY = clamp(y, wall.y, wall.y + wall.h);
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 < radius ** 2;
}

const BRICK_W = 8;
const BRICK_H = 4;

function brickSurvives(col, row, hp, seed) {
  if (hp >= 3) return true;
  const n = Math.abs((col * 13 + row * 7 + seed) % 4);
  return hp === 2 ? n !== 0 : n > 1;
}

function drawBrickWall(ctx, wall) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(wall.x, wall.y, wall.w, wall.h);
  ctx.clip();
  ctx.fillStyle = "#000000";
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  const seed = Math.floor(wall.x * 3 + wall.y * 7);
  const hp = wall.hp ?? 3;
  const y0 = Math.floor(wall.y / BRICK_H) * BRICK_H;
  const x0 = Math.floor(wall.x / BRICK_W) * BRICK_W;
  for (let y = y0; y < wall.y + wall.h; y += BRICK_H) {
    const row = Math.round(y / BRICK_H);
    const stagger = (row & 1) * (BRICK_W / 2);
    for (let x = x0 - stagger; x < wall.x + wall.w; x += BRICK_W) {
      const col = Math.round((x + stagger) / BRICK_W);
      if (!brickSurvives(col, row, hp, seed)) continue;
      ctx.fillStyle = "#A81000";
      ctx.fillRect(x, y, BRICK_W - 1, BRICK_H - 1);
      ctx.fillStyle = "#FC9838";
      ctx.fillRect(x, y, BRICK_W - 1, 1);
      ctx.fillStyle = "#FC7400";
      ctx.fillRect(x, y + 1, BRICK_W - 2, BRICK_H - 3);
    }
  }
  ctx.restore();
}

function drawSteelWall(ctx, wall) {
  const { x, y, w, h } = wall;
  ctx.fillStyle = "#747474";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#FCFCFC";
  ctx.fillRect(x, y, w - 1, 2);
  ctx.fillRect(x, y, 2, h - 1);
  ctx.fillStyle = "#3C3C3C";
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = "#BCBCBC";
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = "#E8E8E8";
  ctx.fillRect(x + w * 0.38, y + 3, w * 0.24, h - 6);
  ctx.fillRect(x + 3, y + h * 0.38, w - 6, h * 0.24);
  ctx.fillStyle = "#FCFCFC";
  ctx.fillRect(x + w / 2 - 2, y + h / 2 - 2, 4, 4);
  ctx.fillStyle = "#3C3C3C";
  ctx.fillRect(x + w / 2, y + h / 2, 2, 2);
}

export class Tank {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.columns = COLS;
    this.rows = ROWS;
    this.keys = new Set();
    this.keyPulse = new Set();
    this.onEvent = null;
    this.motionDrive = 0;
    this.motionTurn = 0;
    this.reset();
  }

  emit(type, detail = {}) {
    this.onEvent?.(type, { ...detail, width: this.width, height: this.height });
  }

  makeTank(player, spawn, color) {
    const { x, y } = cellCenter(spawn.col, spawn.row);
    return {
      player,
      col: spawn.col,
      row: spawn.row,
      facing: spawn.facing,
      x,
      y,
      rotation: FACING[spawn.facing].rotation,
      color,
      destroyed: false,
      cooldown: 0,
      flash: 0,
      moveCooldown: 0,
    };
  }

  syncTankPixels(tank) {
    const { x, y } = cellCenter(tank.col, tank.row);
    tank.x = x;
    tank.y = y;
    tank.rotation = FACING[tank.facing].rotation;
  }

  reset() {
    this.tanks = {
      1: this.makeTank(1, P1_SPAWN, "#64f4ff"),
      2: this.makeTank(2, P2_SPAWN, "#fb7185"),
    };
    this.walls = makeWalls();
    this.bullets = [];
    this.particles = [];
    this.scores = { 1: 0, 2: 0 };
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.winner = null;
    this.keys.clear();
    this.keyPulse.clear();
    this.motionDrive = 0;
    this.motionTurn = 0;
    this.motionDriveArmed = true;
    this.motionTurnArmed = true;
    this.winSequence = this.winSequence || 0;
  }

  setMotionInput(drive, turn) {
    this.motionDrive = clamp(Number(drive) || 0, -1, 1);
    this.motionTurn = clamp(Number(turn) || 0, -1, 1);
    this.applyMotionActions();
  }

  applyMotionActions() {
    if (!this.running || this.paused || this.gameOver) return;
    const tank = this.tanks[1];
    if (!tank || tank.destroyed) return;
    if (this.p1KeyboardHeld()) return;

    const drive = this.motionDrive;
    const turn = this.motionTurn;

    if (Math.abs(drive) <= MOTION_NEUTRAL) this.motionDriveArmed = true;
    if (Math.abs(turn) <= MOTION_NEUTRAL) this.motionTurnArmed = true;

    const driveCross = this.motionDriveArmed && Math.abs(drive) >= MOTION_THRESHOLD;
    const turnCross = this.motionTurnArmed && Math.abs(turn) >= MOTION_THRESHOLD;
    if (!driveCross && !turnCross) return;

    const useTurn = turnCross && (!driveCross || Math.abs(turn) >= Math.abs(drive));
    if (useTurn) {
      this.motionTurnArmed = false;
      if (tank.moveCooldown > 0) return;
      this.moveInDirection(tank, turn > 0 ? 0 : 2);
      tank.moveCooldown = MOVE_COOLDOWN;
      return;
    }

    this.motionDriveArmed = false;
    if (tank.moveCooldown > 0) return;
    this.moveInDirection(tank, drive > 0 ? 1 : 3);
    tank.moveCooldown = MOVE_COOLDOWN;
  }

  p1KeyboardHeld() {
    return (
      this.keys.has(P1_KEYS.up) ||
      this.keys.has(P1_KEYS.down) ||
      this.keys.has(P1_KEYS.left) ||
      this.keys.has(P1_KEYS.right)
    );
  }

  start() {
    const alreadyRunning = this.running && !this.gameOver;
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
    if (!alreadyRunning) {
      this.emit("start");
    }
  }

  restart() {
    this.reset();
    this.running = true;
    this.paused = false;
    this.emit("start");
  }

  togglePause() {
    if (!this.running || this.gameOver) return this.paused;
    this.paused = !this.paused;
    this.keys.clear();
    this.keyPulse.clear();
    this.emit(this.paused ? "pause" : "resume");
    return this.paused;
  }

  handleKeyDown(code) {
    if (!this.keys.has(code)) this.keyPulse.add(code);
    this.keys.add(code);
  }

  handleKeyUp(code) {
    this.keys.delete(code);
    this.keyPulse.delete(code);
  }

  clearKeys() {
    this.keys.clear();
    this.keyPulse.clear();
  }

  update(deltaSeconds) {
    const dt = clamp(Number(deltaSeconds) || 0, 0, 0.05);
    if (this.paused) return;

    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (!this.running || this.gameOver) {
      this.keyPulse.clear();
      return;
    }

    for (const tank of Object.values(this.tanks)) {
      tank.cooldown = Math.max(0, tank.cooldown - dt);
      tank.flash = Math.max(0, tank.flash - dt);
      tank.moveCooldown = Math.max(0, tank.moveCooldown - dt);
    }

    this.processTankKeys(this.tanks[1], P1_KEYS);
    this.processTankKeys(this.tanks[2], P2_KEYS);
    this.keyPulse.clear();

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.life -= dt;
      bullet.age += dt;
      if (bullet.life <= 0 || this.advanceBullet(bullet, dt)) {
        this.bullets.splice(i, 1);
      }
      if (this.gameOver) break;
    }
  }

  processTankKeys(tank, bindings) {
    if (tank.destroyed) return;

    const firePulse = this.keyPulse.has(bindings.fire);
    const fireHeld = this.keys.has(bindings.fire);
    const couldFire = tank.cooldown <= 0 && (firePulse || fireHeld);
    if (firePulse || fireHeld) this.fire(tank);
    if (couldFire) return;
    if (tank.moveCooldown > 0) return;

    const facing = this.readMoveFacing(bindings);
    if (facing === null) return;
    this.moveInDirection(tank, facing);
    tank.moveCooldown = MOVE_COOLDOWN;
  }

  readMoveFacing(bindings) {
    const order = [
      [bindings.up, 3],
      [bindings.down, 1],
      [bindings.left, 2],
      [bindings.right, 0],
    ];
    for (const [code, facing] of order) {
      if (this.keyPulse.has(code)) return facing;
    }
    for (const [code, facing] of order) {
      if (this.keys.has(code)) return facing;
    }
    return null;
  }

  moveInDirection(tank, facing) {
    tank.facing = facing;
    this.syncTankPixels(tank);
    const dir = FACING[facing];
    const col = tank.col + dir.x;
    const row = tank.row + dir.y;
    if (!this.canOccupy(tank, col, row)) return;
    tank.col = col;
    tank.row = row;
    this.syncTankPixels(tank);
  }

  canOccupy(tank, col, row) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
    if (this.walls.some((w) => w.col === col && w.row === row)) return false;
    const other = this.tanks[tank.player === 1 ? 2 : 1];
    if (!other.destroyed && other.col === col && other.row === row) return false;
    return true;
  }

  fire(tank) {
    if (!this.running || this.paused || tank.destroyed || tank.cooldown > 0) return;
    const facing = FACING[tank.facing];
    const muzzle = Math.min(cellWidth(), cellHeight()) * 0.48;
    const x = tank.x + facing.x * muzzle;
    const y = tank.y + facing.y * muzzle;
    this.bullets.push({
      x,
      y,
      vx: facing.x * BULLET_SPEED,
      vy: facing.y * BULLET_SPEED,
      owner: tank.player,
      age: 0,
      life: BULLET_LIFE,
    });
    tank.cooldown = FIRE_COOLDOWN;
    tank.flash = 0.1;
    this.emit("fire", { playerId: tank.player, x, y });
  }

  wallPixel(wall) {
    const rect = cellRect(wall.col, wall.row);
    return { ...rect, breakable: wall.breakable, hp: wall.hp };
  }

  advanceBullet(b, dt) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 3));
    const step = dt / steps;
    const radius = 4;

    for (let s = 0; s < steps; s++) {
      const nextX = b.x + b.vx * step;
      const nextY = b.y + b.vy * step;

      if (nextX < radius || nextX > this.width - radius || nextY < radius || nextY > this.height - radius) {
        this.addParticles(b.x, b.y, "#c8c8c8", 6);
        return true;
      }

      for (let i = 0; i < this.walls.length; i++) {
        const wall = this.walls[i];
        const rect = this.wallPixel(wall);
        if (!circleHitsRect(nextX, nextY, radius, rect)) continue;

        if (wall.breakable) {
          wall.hp--;
          this.addParticles(nextX, nextY, "#E05010", 8);
          if (wall.hp <= 0) {
            this.walls.splice(i, 1);
            this.emit("cover-break", { x: nextX, y: nextY });
          } else {
            this.emit("cover-hit", { x: nextX, y: nextY, hp: wall.hp });
          }
        } else {
          this.addParticles(nextX, nextY, "#c8c8c8", 6);
          this.emit("cover-hit", { x: nextX, y: nextY, hp: 2 });
        }
        return true;
      }

      b.x = nextX;
      b.y = nextY;
      for (const tank of Object.values(this.tanks)) {
        if (tank.destroyed || (tank.player === b.owner && b.age < 0.15)) continue;
        const hitbox = cellRect(tank.col, tank.row);
        if (circleHitsRect(b.x, b.y, radius, hitbox)) {
          tank.destroyed = true;
          this.winner = tank.player === 1 ? 2 : 1;
          this.scores[this.winner] = 1;
          this.gameOver = true;
          this.running = false;
          this.winSequence++;
          this.addParticles(tank.x, tank.y, tank.color, 35);
          this.emit("explode", {
            playerId: tank.player,
            winner: this.winner,
            x: tank.x,
            y: tank.y,
          });
          return true;
        }
      }
    }
    return false;
  }

  addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = 35 + Math.random() * 145;
      this.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        color, life: 0.35 + Math.random() * 0.45,
      });
    }
  }

  draw() {
    const ctx = this.context;
    const cellW = cellWidth();
    const cellH = cellHeight();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = "rgba(100, 244, 255, 0.14)";
    ctx.lineWidth = 1;
    for (let col = 1; col < COLS; col++) {
      ctx.beginPath();
      ctx.moveTo(col * cellW, 0);
      ctx.lineTo(col * cellW, this.height);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(251, 113, 133, 0.1)";
    for (let row = 1; row < ROWS; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * cellH);
      ctx.lineTo(this.width, row * cellH);
      ctx.stroke();
    }

    for (const wall of this.walls) {
      const rect = this.wallPixel(wall);
      if (wall.breakable) drawBrickWall(ctx, rect);
      else drawSteelWall(ctx, rect);
    }

    for (const tank of Object.values(this.tanks)) {
      if (!tank.destroyed) this.drawTank(ctx, tank);
    }
    for (const b of this.bullets) {
      ctx.shadowColor = b.owner === 1 ? "#64f4ff" : "#fb7185";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawTank(ctx, tank) {
    const unit = Math.min(cellWidth(), cellHeight());
    const scale = unit / 40;
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.rotation);
    ctx.scale(scale, scale);
    ctx.fillStyle = tank.color;
    ctx.fillRect(-15, -12, 30, 24);
    ctx.fillRect(0, -4, 26, 8);
    ctx.fillStyle = "#202124";
    ctx.fillRect(-12, -9, 24, 4);
    ctx.fillRect(-12, 5, 24, 4);
    ctx.fillStyle = tank.color;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    if (tank.flash > 0) {
      ctx.fillStyle = "#fff4ba";
      ctx.fillRect(22, -3, 4, 6);
    }
    ctx.restore();

    const barW = 30 * scale;
    ctx.fillStyle = "rgba(10,20,24,0.8)";
    ctx.fillRect(tank.x - barW / 2, tank.y - 16 * scale, barW, 3);
    ctx.fillStyle = tank.color;
    ctx.fillRect(
      tank.x - barW / 2,
      tank.y - 16 * scale,
      barW * (1 - tank.cooldown / FIRE_COOLDOWN),
      3,
    );
  }
}
