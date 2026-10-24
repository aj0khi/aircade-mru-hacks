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

// Map coordinates follow the 1536×1024 design sketch, scaled to the 960×540 arena.
// All walls are filled axis-aligned rectangles: the drawn pixels and collision boxes agree.
const MAP_SCALE_X = WORLD_WIDTH / 1536;
const MAP_SCALE_Y = WORLD_HEIGHT / 1024;
const WALL_THICKNESS = 15;

function segment(x1, y1, x2, y2, breakable = false) {
  const ax = x1 * MAP_SCALE_X, ay = y1 * MAP_SCALE_Y;
  const bx = x2 * MAP_SCALE_X, by = y2 * MAP_SCALE_Y;
  const t = WALL_THICKNESS;
  if (Math.abs(y2 - y1) < 0.001) return rect((ax + bx) / 2, ay, Math.abs(bx - ax) + t, t, breakable);
  if (Math.abs(x2 - x1) < 0.001) return rect(ax, (ay + by) / 2, t, Math.abs(by - ay) + t, breakable);
  throw new Error("Maze walls must be horizontal or vertical");
}

function makeWalls() {
  return [
    // Upper-left hooked structure. Breakable middle of left vertical.
    segment(232,185,232,266), segment(232,266,232,408,true),
    segment(232,408,232,480), segment(232,480,425,480),
    segment(425,480,425,710), segment(425,710,450,710),
    segment(450,710,531,710,true), segment(531,710,542,710),
    segment(542,481,542,710),

    // Lower-left large U-shaped arena.
    segment(246,636,246,879), segment(246,879,386,879),
    segment(386,879,568,879,true), segment(568,879,726,879),
    segment(726,345,726,496), segment(726,496,726,663,true),
    segment(726,663,726,879),

    // Upper center isolated cover.
    segment(516,111,724,111),

    // Top-right long hooked maze segment.
    segment(929,151,929,317), segment(929,317,1067,317),
    segment(1067,317,1274,317,true), segment(1274,317,1536,317),

    // Right interior wall with a breakable vertical connector.
    segment(1052,527,1315,527),
    segment(1052,527,1052,537), segment(1052,537,1052,665,true),
    segment(1052,665,1052,740),

    // Lower-right cover.
    segment(1130,852,1415,852),
    segment(897,875,897,1024),
  ];
}

// Each visible shape in drawTank is collision-tested in exactly the same local-space
// coordinates. Tank silhouettes consist of a rectangular chassis and its narrow cannon.
const TANK_SHAPES = [
  { cx: 0, cy: 0, halfW: 15, halfH: 12 },
  { cx: 13, cy: 0, halfW: 13, halfH: 4 },
];

function tankPolygons(tank, x = tank.x, y = tank.y, rotation = tank.rotation) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return TANK_SHAPES.map(({ cx, cy, halfW, halfH }) =>
    [[cx-halfW,cy-halfH],[cx+halfW,cy-halfH],[cx+halfW,cy+halfH],[cx-halfW,cy+halfH]]
      .map(([lx,ly]) => ({ x: x + lx*c-ly*s, y: y + lx*s+ly*c }))
  );
}

function polygonsOverlap(a, b) {
  for (const polygon of [a,b]) {
    for (let i=0; i<polygon.length; i++) {
      const p=polygon[i], q=polygon[(i+1)%polygon.length];
      const nx=-(q.y-p.y), ny=q.x-p.x;
      const project=pts=>pts.map(v=>v.x*nx+v.y*ny);
      const pa=project(a), pb=project(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

function wallPolygon(w) {
  return [{x:w.x,y:w.y},{x:w.x+w.w,y:w.y},
          {x:w.x+w.w,y:w.y+w.h},{x:w.x,y:w.y+w.h}];
}

function circleHitsPolygon(x, y, r, poly) {
  // For a rotated rectangular tank component, convert to the component's axes.
  const origin=poly[0], edgeX=poly[1], edgeY=poly[3];
  const ux=edgeX.x-origin.x, uy=edgeX.y-origin.y;
  const vx=edgeY.x-origin.x, vy=edgeY.y-origin.y;
  const lenX=Math.hypot(ux,uy), lenY=Math.hypot(vx,vy);
  const dx=x-origin.x, dy=y-origin.y;
  const localX=clamp((dx*ux+dy*uy)/lenX,0,lenX);
  const localY=clamp((dx*vx+dy*vy)/lenY,0,lenY);
  const nearX=origin.x+ux/lenX*localX+vx/lenY*localY;
  const nearY=origin.y+uy/lenX*localX+vy/lenY*localY;
  return (x-nearX)**2+(y-nearY)**2 <= r*r;
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
    // Hull and barrel collide using the same oriented rectangles that are drawn.
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
    const rotationBefore = tank.rotation;
    tank.rotation += turn * 2.4 * dt;
    if (!this.canOccupy(tank, tank.x, tank.y)) tank.rotation = rotationBefore;
    const dx = Math.cos(tank.rotation) * move * 165 * dt;
    const dy = Math.sin(tank.rotation) * move * 165 * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
    for (let i = 0; i < steps; i++) {
      if (this.canOccupy(tank, tank.x + dx / steps, tank.y)) tank.x += dx / steps;
      if (this.canOccupy(tank, tank.x, tank.y + dy / steps)) tank.y += dy / steps;
    }
  }

  canOccupy(tank, x, y) {
    const polygons = tankPolygons(tank, x, y);
    if (polygons.some(poly => poly.some(p => p.x < 0 || p.y < 0 || p.x > this.width || p.y > this.height))) return false;
    if (polygons.some(poly => this.walls.some(w => polygonsOverlap(poly, wallPolygon(w))))) return false;
    const other = this.tanks[tank.player === 1 ? 2 : 1];
    return other.destroyed || !polygons.some(poly => tankPolygons(other).some(otherPoly => polygonsOverlap(poly, otherPoly)));
  }

  fire(tank) {
    if (!this.running || this.paused || tank.destroyed || tank.cooldown > 0) return;
    const muzzle = 22;
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
        if (tankPolygons(tank).some(poly => circleHitsPolygon(b.x, b.y, radius, poly))) {
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
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(150, 255, 207, 0)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 0; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = 0; y < 0; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
    }

    for (const wall of this.walls) {
      // No decorative overhang: rendered rectangle is exactly the collision shape.
      ctx.fillStyle = wall.breakable
        ? (wall.hp === 3 ? "#d67837" : wall.hp === 2 ? "#e49b51" : "#f2bd7a")
        : "#b84320";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
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
    // Collision shapes: hull [-15,15]×[-12,12], barrel [0,26]×[-4,4].
    ctx.fillStyle = tank.color;
    ctx.fillRect(-15, -12, 30, 24);
    ctx.fillRect(0, -4, 26, 8);
    // Surface details stay inside the collidable silhouette.
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

    // Cooldown indicator is UI only, not physical tank geometry.
    ctx.fillStyle = "rgba(10,20,24,0.8)";
    ctx.fillRect(tank.x - 15, tank.y - 26, 30, 3);
    ctx.fillStyle = tank.color;
    ctx.fillRect(tank.x - 15, tank.y - 26, 30 * (1 - tank.cooldown / 0.65), 3);
  }

}
