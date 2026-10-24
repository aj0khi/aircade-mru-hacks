const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Adapted from public/bowling-3d/js/bowlphysics.js, used under the included GPLv3 license.
const BALL_RADIUS = 0.109;
const BALL_MASS = 13 * 0.45359237;
const PIN_MASS = 1.53;
const PIN_DISTANCE = 0.304;
const LANE_WIDTH = 1.06;
const LANE_START_Z = 3;
const LANE_END_Z = -0.9;
const FIXED_TIME_STEP = 0.01;

export class Bowling {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.lastSwing = 0;
    this.physicsReady = false;
    this.physics = null;
    this.pointerStart = null;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerStart = { x: event.offsetX, y: event.offsetY };
      this.updateAimFromPointer(event.offsetX);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (this.pointerStart) this.updateAimFromPointer(event.offsetX);
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!this.pointerStart) return;
      const drag = this.pointerStart.y - event.offsetY;
      this.updateAimFromPointer(event.offsetX);
      if (drag > 20) this.throwBall(clamp(drag / 180, 0.35, 1));
      this.pointerStart = null;
    });
    this.reset();
  }

  async initializePhysics() {
    if (this.physicsReady || this.physicsInitializing) return;
    this.physicsInitializing = true;
    if (typeof Ammo !== "function") {
      this.physicsInitializing = false;
      return;
    }
    try {
      const ammo = await Ammo();
      this.physics = { ammo, bodies: [], accumulator: 0 };
      this.physicsReady = true;
      this.resetPhysicsBodies();
    } catch (error) {
      console.warn("HeadPilot Bowling physics unavailable; using local fallback.", error);
    } finally {
      this.physicsInitializing = false;
    }
  }

  reset() {
    this.players = [
      { name: "PLAYER 1", score: 0 },
      { name: "PLAYER 2", score: 0 }
    ];

    this.currentPlayer = 0;
    this.targetScore = 50;
    this.winner = null;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.aim = 0;
    this.power = 0;
    this.ball = null;
    this.scoredPins = 0;
    this.lastSwing = 0;
    this.pins = this.createPins();
    if (this.physicsReady) this.resetPhysicsBodies();
    this.message = "PRESS START";
  }

  createPins() {
    const formation = [
      [-0.27, 3], [-0.09, 3], [0.09, 3], [0.27, 3],
      [-0.18, 2], [0, 2], [0.18, 2],
      [-0.09, 1], [0.09, 1],
      [0, 0],
    ];
    return formation.map(([x, row]) => ({
      x,
      z: 0.78 + row * 0.035,
      row,
      standing: true,
      fallen: false,
      fall: 0,
      fallDirection: 1,
      vx: 0,
      vz: 0,
      spin: 0,
    }));
  }

  start() {
    if (this.gameOver) this.reset();
    if (!this.physicsReady && !this.physicsInitializing) {
      window.setTimeout(() => this.initializePhysics(), 0);
    }
    this.running = true;
    this.paused = false;
    this.message = "AIM THE LANE";
  }

  restart() {
    this.reset();
    this.start();
  }

  togglePause() {
    if (!this.running || this.gameOver || this.ball) return this.paused;
    this.paused = !this.paused;
    this.message = this.paused ? "PAUSED" : "AIM THE LANE";
    return this.paused;
  }

  setAimInput(value) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) this.aim = clamp(numericValue, -1, 1);
  }

  updateAimFromPointer(pointerX) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    this.setAimInput(((pointerX * scaleX) / this.width - 0.5) * 2);
  }

  setMotionInput(rollValue, swingValue) {
    this.setAimInput(rollValue);
    const swing = clamp(Number(swingValue) || 0, -1, 1);
    if (swing > 0.62 && this.lastSwing <= 0.62) this.throwBall(swing);
    this.lastSwing = swing;
  }

  throwBall(power = 0.9) {
    if (!this.running || this.paused || this.gameOver || this.ball) return;
    this.power = clamp(power, 0.25, 1);
    this.ball = {
      x: this.aim * 0.74,
      z: 0,
      targetX: this.aim * 0.74,
      speed: 0.52 + this.power * 0.28,
      rotation: 0,
      impact: false,
    };
    if (this.physicsReady) this.releasePhysicsBall();
    this.message = "ROLLING";
  }

  handleKey(code) {
    if (code === "ArrowLeft") this.setAimInput(this.aim - 0.08);
    if (code === "ArrowRight") this.setAimInput(this.aim + 0.08);
    if (code === "Space") this.throwBall();
  }

  update(deltaSeconds) {
    if (!this.running || this.paused || this.gameOver || !this.ball) return;
    const delta = Math.min(deltaSeconds, 0.05);
    if (this.physicsReady) {
      this.updatePhysics(delta);
      return;
    }
    this.ball.z += delta * this.ball.speed;
    this.ball.x += (this.ball.targetX - this.ball.x) * delta * 2.2;
    this.ball.rotation += delta * (12 + this.power * 18);
    this.updateFallenPins(delta);
    if (!this.ball.impact && this.ball.z >= 0.76) this.hitPins();
    if (this.ball.z >= 1.08) this.finishRoll();
  }

  createBody(shape, mass, position, friction, rollingFriction) {
    const { ammo } = this.physics;
    const transform = new ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new ammo.btVector3(position.x, position.y, position.z));
    const motionState = new ammo.btDefaultMotionState(transform);
    const localInertia = new ammo.btVector3(0, 0, 0);
    if (mass) shape.calculateLocalInertia(mass, localInertia);
    const info = new ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    info.set_m_friction(friction);
    info.set_m_rollingFriction(rollingFriction);
    const body = new ammo.btRigidBody(info);
    this.physics.world.addRigidBody(body);
    this.physics.bodies.push(body);
    return body;
  }

  resetPhysicsBodies() {
    const { ammo } = this.physics;
    if (this.physics.world) {
      for (const body of this.physics.bodies) this.physics.world.removeRigidBody(body);
    } else {
      const collisionConfiguration = new ammo.btDefaultCollisionConfiguration();
      this.physics.world = new ammo.btDiscreteDynamicsWorld(
        new ammo.btCollisionDispatcher(collisionConfiguration),
        new ammo.btDbvtBroadphase(),
        new ammo.btSequentialImpulseConstraintSolver(),
        collisionConfiguration,
      );
    }
    this.physics.bodies = [];
    this.physics.world.setGravity(new ammo.btVector3(0, -9.81, 0));
    const laneShape = new ammo.btBoxShape(new ammo.btVector3(LANE_WIDTH / 2, 0.05, 2.05));
    this.createBody(laneShape, 0, { x: 0, y: -0.05, z: 1.05 }, 0.7, 0.02);
    const ballShape = new ammo.btSphereShape(BALL_RADIUS);
    this.physics.ballBody = this.createBody(ballShape, BALL_MASS, { x: 0, y: 0.16, z: LANE_START_Z }, 0.35, 0.04);
    this.physics.ballBody.setActivationState(4);
    this.physics.pinBodies = [];
    for (const pin of this.pins) {
      const pinShape = new ammo.btCompoundShape();
      const foot = new ammo.btCylinderShape(new ammo.btVector3(0.025, 0.015, 0.025));
      const transform = new ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new ammo.btVector3(0, 0.04, 0));
      pinShape.addChildShape(transform, foot);
      const head = new ammo.btSphereShape(0.032);
      transform.setOrigin(new ammo.btVector3(0, 0.32, 0));
      pinShape.addChildShape(transform, head);
      const body = this.createBody(pinShape, PIN_MASS, {
        x: pin.x, y: 0.2, z: LANE_END_Z + pin.z * 1.7,
      }, 0.4, 0.02);
      this.physics.pinBodies.push(body);
    }
    this.physics.accumulator = 0;
  }

  releasePhysicsBall() {
    const { ammo, ballBody } = this.physics;
    const transform = new ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new ammo.btVector3(this.ball.x, 0.16, LANE_START_Z));
    ballBody.setWorldTransform(transform);
    ballBody.getMotionState().setWorldTransform(transform);
    ballBody.setLinearVelocity(new ammo.btVector3(this.ball.x * 0.2, 0, -(3 + this.power * 3)));
    ballBody.setAngularVelocity(new ammo.btVector3(8 + this.power * 8, 0, 0));
    ballBody.activate();
  }

  updatePhysics(delta) {
    const { ammo, world, ballBody, pinBodies } = this.physics;
    this.physics.accumulator += delta;
    while (this.physics.accumulator >= FIXED_TIME_STEP) {
      world.stepSimulation(FIXED_TIME_STEP, 1, FIXED_TIME_STEP);
      this.physics.accumulator -= FIXED_TIME_STEP;
    }
    const transform = new ammo.btTransform();
    ballBody.getMotionState().getWorldTransform(transform);
    const origin = transform.getOrigin();
    if (this.ball) {
      this.ball.x = origin.x();
      this.ball.z = (LANE_START_Z - origin.z()) / (LANE_START_Z - LANE_END_Z);
      this.ball.rotation += delta * (12 + this.power * 18);
      if (this.ball.z > 0.76 && !this.ball.impact) this.hitPhysicsPins();
      if (this.ball.z > 1.08 && this.ball.settleRemaining == null) {
        this.ball.settleRemaining = 0.8;
      }
    }
    this.pins.forEach((pin, index) => {
      const pinTransform = new ammo.btTransform();
      pinBodies[index].getMotionState().getWorldTransform(pinTransform);
      const pinOrigin = pinTransform.getOrigin();
      pin.x = pinOrigin.x();
      pin.z = clamp((pinOrigin.z() - LANE_END_Z) / 1.7, 0, 1);
      pin.fallen = pinOrigin.y() < 0.14;
      pin.standing = !pin.fallen;
    });
    const fallenPins = this.pins.filter((pin) => pin.fallen).length;
    if (fallenPins > this.scoredPins) {
      const newPins = fallenPins - this.scoredPins;
      this.players[this.currentPlayer].score += newPins;
      this.scoredPins = fallenPins;
      this.message = fallenPins === 10
        ? "STRIKE!"
        : `${fallenPins} PINS DOWN`;
    }
  }

  hitPhysicsPins() {
    this.ball.impact = true;
    this.message = "IMPACT!";
  }

  hitPins() {
    const impacted = this.pins.filter((pin) => pin.standing
      && Math.abs(pin.x - this.ball.x) < 0.19
      && Math.abs(pin.z - this.ball.z) < 0.1);
    const fallback = this.pins
      .filter((pin) => pin.standing)
      .sort((a, b) => Math.abs(a.x - this.ball.x) - Math.abs(b.x - this.ball.x))[0];
    const firstHit = impacted[0] ?? fallback;
    if (firstHit) {
      this.knockPin(firstHit, this.ball.x - firstHit.x);
      for (const pin of this.pins) {
        const distance = Math.hypot(pin.x - firstHit.x, (pin.z - firstHit.z) * 2);
        if (pin !== firstHit && pin.standing && distance < 0.25) {
          this.knockPin(pin, pin.x - firstHit.x);
        }
      }
    }
    const hitCount = this.pins.filter((pin) => pin.fallen).length;
    const newPins = hitCount - this.pins.filter((pin) => pin.fallen && pin.counted).length;
    this.pins.forEach((pin) => { if (pin.fallen) pin.counted = true; });
    this.players[this.currentPlayer].score += newPins;
    this.ball.impact = true;
    this.message = newPins >= 10 ? "STRIKE!" : `${newPins} PINS DOWN`;
  }

  knockPin(pin, direction) {
    pin.standing = false;
    pin.fallen = true;
    pin.fallDirection = direction < 0 ? -1 : 1;
    pin.vx = pin.fallDirection * (0.16 + this.power * 0.16);
    pin.vz = 0.06 + this.power * 0.1;
    pin.spin = pin.fallDirection * (2.4 + this.power * 2);
  }

  updateFallenPins(delta) {
    for (const pin of this.pins) {
      if (!pin.fallen) continue;
      pin.vx *= Math.pow(0.12, delta);
      pin.vz *= Math.pow(0.18, delta);
      pin.x += pin.vx * delta;
      pin.z += pin.vz * delta;
      pin.spin *= Math.pow(0.22, delta);
      pin.fall = Math.min(1, pin.fall + delta * 2.8);
    }
  }

  finishRoll() {
    this.ball = null;

    const player = this.players[this.currentPlayer];
    if (player.score >= this.targetScore) {
      this.winner = player.name;
      this.gameOver = true;
      this.running = false;
      this.message = `${player.name} WINS!`;
      return;
    }

    this.nextTurn();
  }

  nextTurn() {
    this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    this.pins = this.createPins();
    this.scoredPins = 0;
    this.ball = null;
    this.aim = 0;
    this.power = 0;
    if (this.physicsReady) this.resetPhysicsBodies();
    this.message = `${this.players[this.currentPlayer].name} TURN`;
  }

  lanePoint(progress, laneX = 0) {
    const near = { x: this.width / 2 + laneX * 220, y: this.height - 72 };
    const far = { x: this.width / 2 + laneX * 54, y: 112 };
    return {
      x: near.x + (far.x - near.x) * progress,
      y: near.y + (far.y - near.y) * progress,
    };
  }

  draw() {
    const ctx = this.context;
    ctx.fillStyle = "#070711";
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawBackdrop(ctx);
    const lane = ctx.createLinearGradient(0, 90, 0, this.height);
    lane.addColorStop(0, "#b88ee4");
    lane.addColorStop(0.18, "#7554ac");
    lane.addColorStop(0.55, "#263b78");
    lane.addColorStop(1, "#111d3e");
    ctx.fillStyle = lane;
    ctx.beginPath();
    ctx.moveTo(318, 92); ctx.lineTo(642, 92); ctx.lineTo(866, 540); ctx.lineTo(94, 540);
    ctx.closePath(); ctx.fill();
    this.drawLaneSurface(ctx);
    this.drawLaneMarks(ctx);
    this.drawPinDeck(ctx);
    this.drawPins(ctx);
    this.drawAim(ctx);
    this.drawBall(ctx);
    this.drawHud(ctx);

    if (this.gameOver && this.winner) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = "#fff";
      ctx.font = "900 36px Arial";
      ctx.fillText(`${this.winner} WINS!`, this.width / 2 - 100, this.height / 2);

      ctx.font = "700 18px Arial";
      ctx.fillStyle = "#22d8ff";
      ctx.fillText("for a new game, press START", this.width / 2 - 140, this.height / 2 + 40);
    }
  }

  drawBackdrop(ctx) {
    const glow = ctx.createRadialGradient(this.width / 2, 100, 20, this.width / 2, 180, 420);
    glow.addColorStop(0, "rgba(255, 63, 186, 0.2)");
    glow.addColorStop(0.5, "rgba(34, 216, 255, 0.05)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "rgba(7, 6, 20, 0.9)";
    ctx.fillRect(0, 0, this.width, 80);
    ctx.fillStyle = "#ffe44a";
    ctx.font = "900 16px Arial";
    ctx.fillText("HEADPILOT LANES", 34, 31);
    ctx.fillStyle = "#8d86ad";
    ctx.font = "700 11px Arial";
    ctx.fillText("LANE 01  //  MOTION BOWLING", 34, 52);
  }

  drawLaneSurface(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(318, 92); ctx.lineTo(642, 92); ctx.lineTo(866, 540); ctx.lineTo(94, 540);
    ctx.clip();
    for (let index = 0; index < 18; index += 1) {
      const left = 94 + index * 43;
      ctx.fillStyle = index % 2 ? "rgba(255, 255, 255, 0.035)" : "rgba(5, 8, 25, 0.08)";
      ctx.beginPath();
      ctx.moveTo(480 + (left - 480) * 0.08, 92);
      ctx.lineTo(480 + (left - 480) * 1.9, 540);
      ctx.lineTo(480 + (left - 480 + 43) * 1.9, 540);
      ctx.lineTo(480 + (left - 480 + 43) * 0.08, 92);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#22d8ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(318, 92); ctx.lineTo(642, 92); ctx.lineTo(866, 540); ctx.lineTo(94, 540);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 63, 186, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(292, 540); ctx.lineTo(300, 92); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(668, 540); ctx.lineTo(660, 92); ctx.stroke();
  }

  drawLaneMarks(ctx) {
    ctx.fillStyle = "rgba(255, 228, 74, 0.8)";
    for (let index = 0; index < 7; index += 1) {
      const point = this.lanePoint(0.15, (index - 3) * 0.18);
      ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.17)";
    ctx.lineWidth = 2;
    for (let index = 1; index < 5; index += 1) {
      const y = 128 + index * 82;
      const inset = index * 15;
      ctx.beginPath(); ctx.moveTo(318 + inset, y); ctx.lineTo(642 - inset, y); ctx.stroke();
    }
  }

  drawPinDeck(ctx) {
    const deck = this.lanePoint(0.74);
    ctx.fillStyle = "rgba(8, 7, 22, 0.5)";
    ctx.beginPath();
    ctx.ellipse(deck.x, deck.y + 12, 110, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 228, 74, 0.38)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawPins(ctx) {
    for (const pin of this.pins) {
      const point = this.lanePoint(pin.z, pin.x);
      const size = 7 + pin.z * 3.2;
      ctx.save();
      ctx.translate(point.x, point.y);
      if (pin.fallen) {
        ctx.rotate(pin.spin * pin.fall);
        ctx.translate(size * 0.8 * pin.fallDirection * pin.fall, size * 0.35 * pin.fall);
      }
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = "#fff9ff";
      ctx.beginPath();
      ctx.moveTo(-size * 0.52, size);
      ctx.quadraticCurveTo(-size * 0.9, size * 0.2, -size * 0.45, -size * 0.18);
      ctx.quadraticCurveTo(-size * 0.3, -size * 0.8, 0, -size);
      ctx.quadraticCurveTo(size * 0.3, -size * 0.8, size * 0.45, -size * 0.18);
      ctx.quadraticCurveTo(size * 0.9, size * 0.2, size * 0.52, size);
      ctx.closePath(); ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#ff3fba";
      ctx.fillRect(-size * 0.5, -size * 0.1, size, size * 0.16);
      ctx.fillStyle = "#22d8ff";
      ctx.fillRect(-size * 0.42, size * 0.12, size * 0.84, size * 0.08);
      ctx.restore();
    }
  }

  drawAim(ctx) {
    const point = this.lanePoint(0, this.aim);
    ctx.strokeStyle = "#ffe44a";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(this.width / 2, 106); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffe44a";
    ctx.beginPath(); ctx.arc(point.x, point.y, 7, 0, Math.PI * 2); ctx.fill();
  }

  drawBall(ctx) {
    const point = this.ball
      ? this.lanePoint(this.ball.z, this.ball.x)
      : this.lanePoint(0, this.aim);
    const radius = this.ball ? 18 - this.ball.z * 10 : 20;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath(); ctx.ellipse(point.x + 6, point.y + 10, radius * 1.1, radius * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "#22d8ff";
    ctx.shadowBlur = 24;
    const ball = ctx.createRadialGradient(point.x - radius * 0.35, point.y - radius * 0.4, 2, point.x, point.y, radius);
    ball.addColorStop(0, "#ffffff");
    ball.addColorStop(0.2, "#64f4ff");
    ball.addColorStop(0.7, "#2875cb");
    ball.addColorStop(1, "#101638");
    ctx.fillStyle = ball;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0a1230";
    for (const hole of [[-0.22, -0.25], [0.05, -0.32], [0.22, -0.12]]) {
      const rotatedX = hole[0] * Math.cos(this.ball?.rotation ?? 0) - hole[1] * Math.sin(this.ball?.rotation ?? 0);
      const rotatedY = hole[0] * Math.sin(this.ball?.rotation ?? 0) + hole[1] * Math.cos(this.ball?.rotation ?? 0);
      ctx.beginPath(); ctx.arc(point.x + radius * rotatedX, point.y + radius * rotatedY, radius * 0.12, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawHud(ctx) {
  ctx.fillStyle = "#ffe44a";
  ctx.font = "bold 24px Arial";

  ctx.fillText(
    `P1: ${this.players[0].score}`,
    30, 110
  );

  ctx.fillText(
    `P2: ${this.players[1].score}`,
    30, 145
  );

  ctx.fillText(
    `TURN: ${this.currentPlayer + 1}`,
    30, 180
  );
}
}
