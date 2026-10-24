// Tank Arena — self-contained arcade game module.
// Same public lifecycle methods as Game.js and Snake.js.
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const TAU = Math.PI * 2;

function rect(cx, cy, width, height, breakable = false) {
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    w: width,
    h: height,
    breakable,
    hp: breakable ? 3 : Infinity,
  };
}

function makeWalls() {
  return [
    // Original corner cover (permanent).
    rect(61, 101, 112, 6), rect(120, 77, 7, 54),
    rect(899, 101, 112, 6), rect(840, 77, 7, 54),
    rect(61, 439, 112, 6), rect(120, 463, 7, 54),
    rect(899, 439, 112, 6), rect(840, 463, 7, 54),

    // Fourteen-segment maze. Bronze segments take 3 hits.
    rect(272, 115, 11, 120), rect(344, 175, 144, 11, true),
    rect(480, 101, 11, 108),
    rect(616, 175, 144, 11, true), rect(688, 115, 11, 120),
    rect(216, 290, 11, 142), rect(288, 331, 144, 11, true),
    rect(480, 270, 160, 11, true),
    rect(744, 290, 11, 142), rect(672, 331, 144, 11, true),
    rect(296, 466, 11, 88), rect(368, 425, 144, 11),
    rect(664, 466, 11, 88), rect(592, 425, 144, 11),
  ];
}

function circleHitsRect(x, y, radius, wall) {
  const nearestX = clamp(x, wall.x, wall.x + wall.w);
  const nearestY = clamp(y, wall.y, wall.y + wall.h);
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 < radius ** 2;
}

export class Tank {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.tankRadius = 21;
    this.keys = new Set();
    this.reset();
  }

  makeTank(player, x, y, rotation, color) {
    return { player, x, y, rotation, color, destroyed: false, cooldown: 0, flash: 0 };
  }

  reset() {
    this.tanks = {
      1: this.makeTank(1, 55, 270, 0, "#64f4ff"),
      2: this.makeTank(2, 905, 270, Math.PI, "#fb7185"),
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
    // Stays monotonic so the UI can react to a new win exactly once.
    this.winSequence = this.winSequence || 0;
  }

  start() {
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
  }

  restart() {
    this.reset();
    this.start();
  }

  togglePause() {
    if (!this.running || this.gameOver) return this.paused;
    this.paused = !this.paused;
    this.keys.clear();
    return this.paused;
  }

  handleKeyDown(code) {
    this.keys.add(code);
  }

  handleKeyUp(code) {
    this.keys.delete(code);
  }

  clearKeys() {
    this.keys.clear();
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

    if (!this.running || this.gameOver) return;

    this.moveTank(this.tanks[1], "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", dt);
    this.moveTank(this.tanks[2], "KeyW", "KeyS", "KeyA", "KeyD", dt);

    if (this.keys.has("Space")) this.fire(this.tanks[1]);
    if (this.keys.has("KeyF")) this.fire(this.tanks[2]);

    for (const tank of Object.values(this.tanks)) {
      tank.cooldown = Math.max(0, tank.cooldown - dt);
      tank.flash = Math.max(0, tank.flash - dt);
    }

    // Iterate backwards so spent bullets can be removed safely.
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

  moveTank(tank, forward, backward, left, right, dt) {
    if (tank.destroyed) return;
    const turn = Number(this.keys.has(right)) - Number(this.keys.has(left));
    const move = Number(this.keys.has(forward)) - Number(this.keys.has(backward));
    tank.rotation += turn * 2.4 * dt;
    const dx = Math.cos(tank.rotation) * move * 165 * dt;
    const dy = Math.sin(tank.rotation) * move * 165 * dt;
    if (this.canOccupy(tank, tank.x + dx, tank.y)) tank.x += dx;
    if (this.canOccupy(tank, tank.x, tank.y + dy)) tank.y += dy;
  }

  canOccupy(tank, x, y) {
    const r = this.tankRadius;
    if (x < r || x > this.width - r || y < r || y > this.height - r) return false;
    if (this.walls.some((w) => circleHitsRect(x, y, r, w))) return false;
    const other = this.tanks[tank.player === 1 ? 2 : 1];
    return other.destroyed || Math.hypot(x - other.x, y - other.y) >= r * 2;
  }

  fire(tank) {
    if (!this.running || this.paused || tank.destroyed || tank.cooldown > 0) return;
    const muzzle = 27;
    this.bullets.push({
      x: tank.x + Math.cos(tank.rotation) * muzzle,
      y: tank.y + Math.sin(tank.rotation) * muzzle,
      vx: Math.cos(tank.rotation) * 390,
      vy: Math.sin(tank.rotation) * 390,
      owner: tank.player,
      age: 0,
      life: 4.5,
      bounces: 0,
    });
    tank.cooldown = 0.65;
    tank.flash = 0.1;
  }

  advanceBullet(b, dt) {
    // Substeps prevent high-speed bullets passing through thin walls.
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 3));
    const step = dt / steps;

    for (let s = 0; s < steps; s++) {
      let nextX = b.x + b.vx * step;
      let nextY = b.y + b.vy * step;
      const radius = 4;

      if (nextX < radius || nextX > this.width - radius) {
        b.vx *= -1;
        b.bounces++;
        nextX = clamp(nextX, radius, this.width - radius);
      }
      if (nextY < radius || nextY > this.height - radius) {
        b.vy *= -1;
        b.bounces++;
        nextY = clamp(nextY, radius, this.height - radius);
      }

      let reflected = false;
      for (let i = 0; i < this.walls.length; i++) {
        const wall = this.walls[i];
        if (!circleHitsRect(nextX, nextY, radius, wall)) continue;

        if (wall.breakable) {
          wall.hp--;
          this.addParticles(nextX, nextY, "#ffc178", 8);
          if (wall.hp <= 0) this.walls.splice(i, 1);
          return true; // Bullet absorbed by breakable wall.
        }

        // Determine whether the shot entered from the side or top/bottom.
        const sideHit = b.x + radius <= wall.x || b.x - radius >= wall.x + wall.w;
        const topHit = b.y + radius <= wall.y || b.y - radius >= wall.y + wall.h;
        if (sideHit && !topHit) b.vx *= -1;
        else if (topHit && !sideHit) b.vy *= -1;
        else {
          // Corner case: choose the axis with less overlap.
          const xPenetration = Math.min(Math.abs(nextX + radius - wall.x), Math.abs(wall.x + wall.w - (nextX - radius)));
          const yPenetration = Math.min(Math.abs(nextY + radius - wall.y), Math.abs(wall.y + wall.h - (nextY - radius)));
          if (xPenetration < yPenetration) b.vx *= -1;
          else b.vy *= -1;
        }
        b.bounces++;
        reflected = true;
        break;
      }

      if (reflected) {
        if (b.bounces > 12) return true;
        continue; // Remain at previous safe location after ricochet.
      }

      b.x = nextX;
      b.y = nextY;
      for (const tank of Object.values(this.tanks)) {
        // The shot cannot hit its owner immediately on spawning.
        if (tank.destroyed || (tank.player === b.owner && b.age < 0.15)) continue;
        if (Math.hypot(b.x - tank.x, b.y - tank.y) <= this.tankRadius + radius) {
          tank.destroyed = true;
          this.winner = tank.player === 1 ? 2 : 1;
          this.scores[this.winner] = 1;
          this.gameOver = true;
          this.running = false;
          this.winSequence++;
          this.addParticles(tank.x, tank.y, tank.color, 35);
          return true;
        }
      }
    }
    return b.bounces > 12;
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
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);

    // Dark tactical arena, consistent with the existing neon arcade styling.
    ctx.fillStyle = "#09251d";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(150, 255, 207, 0.075)";
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
    }

    for (const wall of this.walls) {
      ctx.fillStyle = wall.breakable
        ? (wall.hp === 3 ? "#a96523" : wall.hp === 2 ? "#c48b3b" : "#e6bd78")
        : "#536a68";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = wall.breakable ? "rgba(255,221,158,0.45)" : "rgba(218,255,241,0.25)";
      ctx.fillRect(wall.x, wall.y, wall.w, Math.min(3, wall.h));
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
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.rotation);
    ctx.shadowColor = tank.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#122e30";
    ctx.strokeStyle = tank.color;
    ctx.lineWidth = 3;
    ctx.fillRect(-22, -17, 44, 34);
    ctx.strokeRect(-22, -17, 44, 34);
    ctx.fillStyle = tank.color;
    ctx.fillRect(-19, -19, 38, 5);
    ctx.fillRect(-19, 14, 38, 5);
    ctx.fillRect(0, -5, 36, 10);
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    if (tank.flash > 0) {
      ctx.fillStyle = "#fff4ba";
      ctx.beginPath(); ctx.arc(39, 0, 8, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // Reload indicator, above tank in screen coordinates.
    ctx.fillStyle = "rgba(10,20,24,0.8)";
    ctx.fillRect(tank.x - 22, tank.y - 33, 44, 4);
    ctx.fillStyle = tank.color;
    ctx.fillRect(tank.x - 22, tank.y - 33, 44 * (1 - tank.cooldown / 0.65), 4);
  }
}
