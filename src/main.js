import { Game } from "./game/Pong.js";
import { Snake } from "./game/Snake.js";
import { Breakout } from "./game/Breakout.js";
import { Tank } from "./game/Tank.js";
import "./styles/main.css";

const canvas = document.querySelector("#game-canvas");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const modeButton = document.querySelector("#mode-button");
const menuButton = document.querySelector("#menu-button");
const gameButton = document.querySelector("#game-button");
const gameTitle = document.querySelector("#game-title");
const gameSubtitle = document.querySelector("#game-subtitle");
const message = document.querySelector("#message");
const modeLabel = document.querySelector("#mode-label");
const playerScore = document.querySelector("#player-score");
const opponentScore = document.querySelector("#opponent-score");
const scoreDivider = document.querySelector("#score-divider");
const instructions = document.querySelector("#instructions");
const controls = document.querySelector("#game-controls");
const gameShell = document.querySelector(".game-shell");
const gameMenu = document.querySelector("#game-menu");
const gameChoices = [...document.querySelectorAll(".game-choice")];
const bowling3dFrame = document.querySelector("#bowling-3d-frame");
const pressedKeys = new Set();
const pong = new Game(canvas);
const snake = new Snake(canvas);
const breakout = new Breakout(canvas);
const tank = new Tank(canvas);
let activeGame = null;
let gameType = null;
let lastTime = performance.now();
let seenGoalSequence = 0;
let seenTankWinSequence = 0;
let latestBowling3dSample = null;
let bowling3dPaused = false;
let motionNeutral = { roll: 0, pitch: 0, swing: 0 };
let motionSocket = null;
let motionSocketUrl = null;
let lastMotionTimestamp = 0;
let motionStaleTimer = null;

const keyToInput = {
  KeyW: [1, -1],
  KeyS: [1, 1],
  ArrowUp: [2, -1],
  ArrowDown: [2, 1],
};
// Tank changes
const tankKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "KeyF",
]);

function sendBowling3dMotion(sample) {
  latestBowling3dSample = sample;
  if (!bowling3dFrame.contentWindow) return;
  bowling3dFrame.contentWindow.postMessage({
    type: "headpilot-bowling-motion",
    ...sample,
  }, window.location.origin);
}

function calibrateBowlingMotion(sample = {}) {
  const roll = sample.roll ?? sample.horizontal ?? 0;
  const pitch = sample.pitch ?? 0;
  const swing = sample.swing ?? sample.forward ?? 0;
  motionNeutral = {
    roll: Number.isFinite(Number(roll)) ? Number(roll) : 0,
    pitch: Number.isFinite(Number(pitch)) ? Number(pitch) : 0,
    swing: Number.isFinite(Number(swing)) ? Number(swing) : 0,
  };
}

function forwardBowlingMotion(sample = {}) {
  const rollValue = sample.roll ?? sample.horizontal ?? 0;
  const pitchValue = sample.pitch ?? 0;
  const swingValue = sample.swing ?? sample.forward ?? 0;
  const roll = Number(rollValue) - motionNeutral.roll;
  const pitch = Number(pitchValue) - motionNeutral.pitch;
  const swing = Number(swingValue) - motionNeutral.swing;
  if (![roll, pitch, swing].every(Number.isFinite)) return false;
  const normalized = {
    roll: Math.max(-1, Math.min(1, roll)),
    pitch: Math.max(-1, Math.min(1, pitch)),
    swing: Math.max(-1, Math.min(1, swing)),
    horizontal: Math.max(-1, Math.min(1, roll)),
    forward: Math.max(-1, Math.min(1, swing)),
    timestamp: sample.timestamp ?? performance.now(),
  };
  if (gameType === "pong") {
    pong.setPaddleInput(1, normalized.roll);
  } else if (gameType === "snake") {
    updateSnakeMotion(normalized.roll, normalized.pitch);
  } else if (gameType === "breakout") {
    breakout.setPaddleInput(normalized.roll);
  }
  sendBowling3dMotion(normalized);
  return true;
}

function handleMotionBridgeMessage(event) {
  let sample;
  try {
    sample = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    console.warn("HeadPilot motion bridge sent invalid JSON.");
    return false;
  }
  if (!sample || sample.type !== "motion") {
    console.warn("HeadPilot motion bridge sent an unsupported message.");
    return false;
  }
  const accepted = forwardBowlingMotion(sample);
  if (accepted) lastMotionTimestamp = performance.now();
  return accepted;
}

function clearStaleMotion() {
  if (!lastMotionTimestamp || performance.now() - lastMotionTimestamp < 300) return;
  forwardBowlingMotion({ roll: 0, pitch: 0, swing: 0 });
  lastMotionTimestamp = 0;
}

function connectMotionBridge(url = "ws://127.0.0.1:8787") {
  disconnectMotionBridge();
  motionSocketUrl = url;
  motionSocket = new WebSocket(url);
  motionSocket.addEventListener("message", handleMotionBridgeMessage);
  motionSocket.addEventListener("close", () => {
    if (motionSocket?.url === url) motionSocket = null;
  });
  motionSocket.addEventListener("error", () => {
    motionSocket?.close();
  });
  return motionSocket;
}

function disconnectMotionBridge() {
  motionSocket?.close();
  motionSocket = null;
  motionSocketUrl = null;
  lastMotionTimestamp = 0;
  if (motionStaleTimer) {
    window.clearInterval(motionStaleTimer);
    motionStaleTimer = null;
  }
}

function updateSnakeMotion(roll, pitch) {
  const deadzone = 0.32;
  if (Math.max(Math.abs(roll), Math.abs(pitch)) < deadzone) return;
  if (Math.abs(roll) >= Math.abs(pitch)) {
    snake.handleKey(roll < 0 ? "ArrowLeft" : "ArrowRight");
  } else {
    snake.handleKey(pitch < 0 ? "ArrowUp" : "ArrowDown");
  }
}

function sendBowling3dCommand(command) {
  if (!bowling3dFrame.contentWindow) return;
  bowling3dFrame.contentWindow.postMessage({
    type: "headpilot-bowling-command",
    command,
  }, window.location.origin);
}

bowling3dFrame.addEventListener("load", () => {
  bowling3dPaused = false;
  sendBowling3dCommand("start");
  if (latestBowling3dSample) sendBowling3dMotion(latestBowling3dSample);
});

function updateKeyboardInput() {
  for (const playerId of [1, 2]) {
    const up = [...pressedKeys].some((key) => keyToInput[key]?.[0] === playerId && keyToInput[key][1] < 0);
    const down = [...pressedKeys].some((key) => keyToInput[key]?.[0] === playerId && keyToInput[key][1] > 0);
    pong.setPaddleInput(playerId, up === down ? 0 : (up ? -1 : 1));
  }
}


window.addEventListener("keydown", (event) => {

  // Choose a game from the arcade menu using 1-5
  if (!gameType && [
    "Digit1", "Digit2", "Digit3", "Digit4", "Digit5"
  ].includes(event.code)) {

    event.preventDefault();

    const gameByKey = {
      Digit1: "pong",
      Digit2: "snake",
      Digit3: "bowling-3d",
      Digit4: "breakout",
      Digit5: "tank",
    };

    selectGame(gameByKey[event.code]);
    return;
  }

  // PONG
  if (gameType === "pong" && keyToInput[event.code]) {
    event.preventDefault();
    pressedKeys.add(event.code);
    updateKeyboardInput();
  }

  // SNAKE
  if (gameType === "snake" && event.code.startsWith("Arrow")) {
    event.preventDefault();
    snake.handleKey(event.code);
  }

  // BREAKOUT
  if (gameType === "breakout" &&
      ["ArrowLeft", "ArrowRight"].includes(event.code)) {

    event.preventDefault();

    breakout.setPaddleInput(
      event.code === "ArrowLeft" ? -1 : 1
    );
  }

  // TANK ARENA
  if (gameType === "tank" && tankKeys.has(event.code)) {
    event.preventDefault();
    tank.handleKeyDown(event.code);
  }

  // Space can start games, including Tank Arena.
  if (event.code === "Space" &&
      activeGame &&
      !activeGame.running) {

    event.preventDefault();
    activeGame.start();
  }

  // Pause / resume
  if (event.code === "KeyP" || event.code === "Escape") {

    if (gameType === "bowling-3d") {
      bowling3dPaused = !bowling3dPaused;

      sendBowling3dCommand(
        bowling3dPaused ? "pause" : "start"
      );

    } else if (activeGame) {
      activeGame.togglePause();
    }
  }
});

window.addEventListener("keyup", (event) => {

  // Pong
  if (keyToInput[event.code]) {
    pressedKeys.delete(event.code);
    updateKeyboardInput();
  }

  // Breakout
  if (gameType === "breakout" &&
      ["ArrowLeft", "ArrowRight"].includes(event.code)) {
    breakout.setPaddleInput(0);
  }

  // Tank Arena
  if (tankKeys.has(event.code)) {
    tank.handleKeyUp(event.code);
  }
});

// Avoid stuck tank controls after switching windows.
window.addEventListener("blur", () => {
  tank.clearKeys();
});

startButton.addEventListener("click", () => {
  if (gameType === "bowling-3d") {
    bowling3dPaused = false;
    sendBowling3dCommand("start");
    updateUI();
    return;
  }
  activeGame.start();
});
pauseButton.addEventListener("click", () => {
  if (gameType === "bowling-3d") {
    bowling3dPaused = !bowling3dPaused;
    sendBowling3dCommand(bowling3dPaused ? "pause" : "start");
    updateUI();
    return;
  }
  activeGame.togglePause();
});
restartButton.addEventListener("click", () => {
  if (gameType === "bowling-3d") {
    bowling3dPaused = false;
    bowling3dFrame.src = `/bowling-3d/index.html?restart=${Date.now()}`;
    return;
  }
  activeGame.restart();
});
modeButton.addEventListener("click", () => {
  pong.setMode(pong.mode === "single" ? "two-player" : "single");
  updateModeUI();
});
menuButton.addEventListener("click", () => {
  selectGame(null);
});
gameButton.addEventListener("click", () => {

  const gameOrder = [
    "pong",
    "snake",
    "bowling-3d",
    "breakout",
    "tank",
  ];

  const currentIndex = gameOrder.indexOf(gameType);
  const nextIndex = (currentIndex + 1) % gameOrder.length;

  selectGame(gameOrder[nextIndex]);
});
gameChoices.forEach((choice) => {
  choice.addEventListener("click", () => selectGame(choice.dataset.game));
});
// tank changes 290

function selectGame(nextGame) {

  // Clear any held tank keys when switching games.
  tank.clearKeys();
  pressedKeys.clear();
  updateKeyboardInput();

  gameType = nextGame;

  // Select the correct engine.
  if (gameType === "pong") {
    activeGame = pong;

  } else if (gameType === "snake") {
    activeGame = snake;

  } else if (gameType === "breakout") {
    activeGame = breakout;

  } else if (gameType === "tank") {
    activeGame = tank;

  } else {
    // Bowling runs inside an iframe.
    // The game-selection menu also has no active engine.
    activeGame = null;
  }

  // Reset the newly selected game.
  if (activeGame) {
    activeGame.reset();
  }

  bowling3dPaused = false;

  // Show or hide the game-selection menu.
  gameMenu.hidden = Boolean(gameType);
  gameShell.classList.toggle("awaiting-choice", !gameType);

  // Show controls when a game is selected.
  controls.hidden = !gameType;

  // Bowling uses its own iframe.
  const isBowling = gameType === "bowling-3d";

  bowling3dFrame.hidden = !isBowling;

  bowling3dFrame.src = isBowling
    ? "/bowling-3d/index.html"
    : "about:blank";

  // All other games use the shared canvas.
  canvas.hidden = isBowling;

  document.querySelector(".scoreboard").hidden = isBowling;
  message.hidden = isBowling;

  updateModeUI();
  updateUI();
}


function updateModeUI() {

  // MAIN ARCADE MENU
  if (!gameType) {
    gameTitle.classList.add("marquee-sign");
    gameTitle.textContent = "HeadPilot Arcade";

    gameSubtitle.textContent =
      "Pick a cabinet and start playing.";

    modeLabel.textContent =
      "INSERT COIN // CHOOSE A GAME";

    modeButton.hidden = true;
    gameButton.hidden = true;
    menuButton.hidden = true;
    controls.hidden = true;
    instructions.hidden = true;

    gameShell.setAttribute(
      "aria-label",
      "HeadPilot game selection"
    );

    instructions.innerHTML =
      "<strong>Choose a game</strong> above to begin";

    return;
  }

  // GAME-SPECIFIC UI INFORMATION
  const gameDetails = {

    pong: {
      title: "Soccer Pong",
      subtitle: "A quick match. First to seven.",
      next: "Snake",
      aria: "Horizontal soccer pitch",
      instructions:
        "<strong>Player 1</strong> W / S · " +
        "<strong>Player 2</strong> ↑ / ↓ · " +
        "P / Esc pauses · First to 7"
    },

    snake: {
      title: "Neon Snake",
      subtitle: "Eat, grow, and own the grid.",
      next: "3D Bowling",
      aria: "Neon Snake playing field",
      instructions:
        "<strong>Move</strong> with arrow keys or motion · " +
        "P / Esc pauses · Collect the gold food"
    },

    "bowling-3d": {
      title: "3D Bowling",
      subtitle: "Open-source physics lane. Drag and flick to bowl.",
      next: "Neon Breakout",
      aria: "3D physics bowling game",
      instructions:
        "<strong>Roll</strong> to aim · " +
        "Swing forward to bowl · Drag also works"
    },

    breakout: {
      title: "Neon Breakout",
      subtitle: "Clear the wall. Chase the score.",
      next: "Tank Arena",
      aria: "Neon Breakout playing field",
      instructions:
        "<strong>Move</strong> with ← / → or roll · " +
        "P / Esc pauses · Clear every brick"
    },

    tank: {
      title: "Tank Arena",
      subtitle: "Two tanks. One battlefield. Last one standing wins.",
      next: "Soccer Pong",
      aria: "Two-player Tank Arena battlefield",
      instructions:
        "<strong>Blue Tank</strong> Arrow keys + Space to fire · " +
        "<strong>Red Tank</strong> WASD + F to fire · " +
        "P / Esc pauses"
    }
  };

  const details = gameDetails[gameType];

  gameTitle.classList.remove("marquee-sign");

  instructions.hidden = false;
  menuButton.hidden = false;
  gameButton.hidden = false;

  gameShell.setAttribute(
    "aria-label",
    `${gameType} game`
  );

  gameTitle.textContent = details.title;
  gameSubtitle.textContent = details.subtitle;
  gameButton.textContent = details.next;

  canvas.setAttribute("aria-label", details.aria);
  instructions.innerHTML = details.instructions;

  // Only Pong has a single/two-player mode selector.
  modeButton.hidden = gameType !== "pong";

  if (gameType === "pong") {
    modeLabel.textContent =
      pong.mode === "two-player"
        ? "2P // LOCAL BATTLE"
        : "1P // VS COMPUTER";

  } else if (gameType === "tank") {
    modeLabel.textContent = "2P // LOCAL BATTLE";

  } else {
    modeLabel.textContent = "1P // SOLO";
  }
}


function updateUI() {

  if (!gameType) {
    startButton.disabled = true;
    pauseButton.disabled = true;
    restartButton.disabled = true;
    return;
  }

  const isSnake = gameType === "snake";
  const isBreakout = gameType === "breakout";
  const isTank = gameType === "tank";

  // Bowling has its own game state.
  if (gameType === "bowling-3d") {
    startButton.disabled = false;
    pauseButton.disabled = false;
    restartButton.disabled = false;

    startButton.textContent = "Start game";
    pauseButton.textContent =
      bowling3dPaused ? "Resume" : "Pause";

    return;
  }

  startButton.disabled = false;
  restartButton.disabled = false;

  // SCORES
  if (isSnake) {
    playerScore.textContent = snake.score;
    opponentScore.textContent = "";
    scoreDivider.textContent = "";

  } else if (isBreakout) {
    playerScore.textContent = breakout.score;
    opponentScore.textContent = "";
    scoreDivider.textContent = "";

  } else if (isTank) {
    playerScore.textContent = tank.scores[1];
    opponentScore.textContent = tank.scores[2];
    scoreDivider.textContent = ":";

  } else {
    playerScore.textContent = pong.scores[1];
    opponentScore.textContent = pong.scores[2];
    scoreDivider.textContent = ":";
  }

  // GAME MESSAGES
  if (isSnake && snake.gameOver) {
    message.textContent = "Game over";
    message.classList.add("visible");

  } else if (isBreakout && breakout.gameOver) {
    message.textContent =
      breakout.bricks.every(brick => !brick.visible)
        ? "Wall cleared"
        : "Game over";

    message.classList.add("visible");

  } else if (isTank && tank.gameOver) {
    message.textContent =
      `PLAYER ${tank.winner} WINS!`;

    message.classList.add("visible");

  } else if (gameType === "pong" && pong.gameOver) {
    message.textContent =
      `Player ${pong.winner} wins`;

    message.classList.add("visible");

  } else if (
    gameType === "pong" &&
    pong.pauseRemaining > 0
  ) {
    message.textContent =
      `Player ${pong.lastScorer} scores`;

    message.classList.add("visible");

  } else if (activeGame.paused) {
    message.textContent = "Game paused";
    message.classList.add("visible");

  } else if (!activeGame.running) {
    message.textContent = "Press start";
    message.classList.add("visible");

  } else {
    message.classList.remove("visible");
  }

  // PAUSE BUTTON
  pauseButton.textContent =
    activeGame.paused ? "Resume" : "Pause";

  pauseButton.disabled =
    !activeGame.running ||
    activeGame.gameOver ||
    (
      gameType === "pong" &&
      pong.pauseRemaining > 0
    );
}

function celebrateGoal() {
  gameShell.classList.remove("shake");
  void gameShell.offsetWidth;
  gameShell.classList.add("shake");
  for (let index = 0; index < 24; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.setProperty("--x", `${(Math.random() - 0.5) * 520}px`);
    piece.style.setProperty("--y", `${120 + Math.random() * 260}px`);
    piece.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 120}ms`);
    piece.style.backgroundColor = index % 3 === 0 ? "#f7d774" : index % 2 ? "#ffffff" : "#64f4ff";
    gameShell.append(piece);
    window.setTimeout(() => piece.remove(), 1100);
  }
}

function frame(now) {

  if (activeGame) {
    activeGame.update((now - lastTime) / 1000);
  }

  lastTime = now;

  // Pong goal animation
  if (gameType === "pong" &&
      pong.goalSequence !== seenGoalSequence) {

    seenGoalSequence = pong.goalSequence;
    celebrateGoal();
  }

  // Tank Arena victory animation
  if (gameType === "tank" &&
      tank.gameOver &&
      tank.winSequence !== seenTankWinSequence) {

    seenTankWinSequence = tank.winSequence;
    celebrateGoal();
  }

  if (activeGame) {
    activeGame.draw();
  }

  updateUI();

  requestAnimationFrame(frame);
}
gameShell.classList.add("awaiting-choice");
updateModeUI();
requestAnimationFrame(frame);

// Stable integration point for future motion adapters.
window.gyroPong = { game: pong, setPaddleInput: (playerId, verticalValue) => pong.setPaddleInput(playerId, verticalValue) };
window.gyroBowling = {
  game: "3d",
  setAimInput: (rollValue) => forwardBowlingMotion({ roll: rollValue, swing: 0 }),
  setMotionInput: (rollValue, swingValue) => forwardBowlingMotion({
    roll: rollValue,
    swing: swingValue,
  }),
  setMotionSample: forwardBowlingMotion,
  calibrate: calibrateBowlingMotion,
  throwBall: (power = 1) => forwardBowlingMotion({ roll: 0, swing: power }),
};
window.gyroSnake = {
  setDirection: (rollValue, pitchValue) => updateSnakeMotion(
    Number(rollValue),
    Number(pitchValue),
  ),
};
window.gyroBreakout = {
  game: breakout,
  setPaddleInput: (rollValue) => breakout.setPaddleInput(rollValue),
};
window.gyroArcade = {
  setMotionSample: forwardBowlingMotion,
  calibrate: calibrateBowlingMotion,
  connectMotionBridge,
  disconnectMotionBridge,
  get motionBridge() {
    return {
      connected: motionSocket?.readyState === WebSocket.OPEN,
      url: motionSocketUrl,
    };
  },
};

motionStaleTimer = window.setInterval(clearStaleMotion, 100);
