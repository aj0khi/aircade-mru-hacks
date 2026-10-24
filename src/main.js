import { Game } from "./game/Pong.js";
import { Snake } from "./game/Snake.js";
import "./styles/main.css";

const canvas = document.querySelector("#game-canvas");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const modeButton = document.querySelector("#mode-button");
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
let activeGame = null;
let gameType = null;
let lastTime = performance.now();
let seenGoalSequence = 0;
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
  if (!gameType && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
    event.preventDefault();
    const gameByKey = { Digit1: "pong", Digit2: "snake", Digit3: "bowling-3d" };
    selectGame(gameByKey[event.code]);
    return;
  }
  if (gameType === "pong" && keyToInput[event.code]) {
    event.preventDefault();
    pressedKeys.add(event.code);
    updateKeyboardInput();
  }
  if (gameType === "snake" && event.code.startsWith("Arrow")) {
    event.preventDefault();
    snake.handleKey(event.code);
  }
  if (event.code === "Space" && gameType !== "bowling-3d" && !activeGame.running) {
    activeGame.start();
  }
  if (event.code === "KeyP" || event.code === "Escape") {
    if (gameType === "bowling-3d") {
      bowling3dPaused = !bowling3dPaused;
      sendBowling3dCommand(bowling3dPaused ? "pause" : "start");
    } else {
      activeGame.togglePause();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (keyToInput[event.code]) {
    pressedKeys.delete(event.code);
    updateKeyboardInput();
  }
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
gameButton.addEventListener("click", () => {
  const nextGame = gameType === "pong"
    ? "snake"
    : gameType === "snake"
      ? "bowling-3d"
      : "pong";
  selectGame(nextGame);
});
gameChoices.forEach((choice) => {
  choice.addEventListener("click", () => selectGame(choice.dataset.game));
});

function selectGame(nextGame) {
  gameType = nextGame;
  activeGame = gameType === "pong" ? pong : gameType === "snake" ? snake : null;
  if (activeGame) activeGame.reset();
  bowling3dPaused = false;
  gameMenu.hidden = true;
  gameShell.classList.remove("awaiting-choice");
  controls.hidden = false;
  bowling3dFrame.hidden = gameType !== "bowling-3d";
  bowling3dFrame.src = gameType === "bowling-3d" ? "/bowling-3d/index.html" : "about:blank";
  canvas.hidden = gameType === "bowling-3d";
  document.querySelector(".scoreboard").hidden = gameType === "bowling-3d";
  message.hidden = gameType === "bowling-3d";
  updateModeUI();
}

function updateModeUI() {
  if (!gameType) {
    gameTitle.textContent = "HeadPilot Arcade";
    gameSubtitle.textContent = "Pick a cabinet and start playing.";
    modeLabel.textContent = "INSERT COIN // CHOOSE A GAME";
    modeButton.hidden = true;
    gameButton.hidden = true;
    controls.hidden = true;
    instructions.hidden = true;
    gameShell.setAttribute("aria-label", "HeadPilot game selection");
    instructions.innerHTML = "<strong>Choose a game</strong> above to begin";
    return;
  }
  instructions.hidden = false;
  gameShell.setAttribute("aria-label", `${gameType} game`);
  const twoPlayer = pong.mode === "two-player";
  const snakeMode = gameType === "snake";
  const bowling3dMode = gameType === "bowling-3d";
  gameTitle.textContent = snakeMode
    ? "Neon Snake"
    : bowling3dMode ? "3D Bowling" : "Soccer Pong";
  gameSubtitle.textContent = snakeMode
    ? "Eat, grow, and own the grid."
    : bowling3dMode
      ? "Open-source physics lane. Drag and flick to bowl."
      : "A quick match. First to seven.";
  gameButton.textContent = snakeMode
    ? "3D Bowling"
    : bowling3dMode ? "Soccer Pong" : "Snake";
  modeButton.hidden = snakeMode || bowling3dMode;
  modeLabel.textContent = snakeMode || bowling3dMode
    ? "1P // SOLO" : (twoPlayer ? "2P // LOCAL BATTLE" : "1P // VS COMPUTER");
  canvas.setAttribute("aria-label", snakeMode
    ? "Neon Snake playing field"
    : bowling3dMode ? "3D physics bowling game" : "Horizontal soccer pitch");
  instructions.innerHTML = snakeMode
    ? "<strong>Move</strong> with the arrow keys or motion <span aria-hidden=\"true\">·</span> P / Esc pauses <span aria-hidden=\"true\">·</span> Collect the gold food"
    : bowling3dMode
      ? "<strong>Roll</strong> to aim <span aria-hidden=\"true\">·</span> Swing forward to bowl <span aria-hidden=\"true\">·</span> Drag also works"
      : "<strong>Player 1</strong> W / S <span aria-hidden=\"true\">·</span> <strong>Player 2</strong> ↑ / ↓ <span aria-hidden=\"true\">·</span> P / Esc pauses <span aria-hidden=\"true\">·</span> First to 7";
}

function updateUI() {
  if (!gameType) {
    startButton.disabled = true;
    pauseButton.disabled = true;
    restartButton.disabled = true;
    return;
  }
  const isSnake = gameType === "snake";
  if (gameType === "bowling-3d") {
    startButton.disabled = false;
    pauseButton.disabled = false;
    restartButton.disabled = false;
    startButton.textContent = "Start game";
    pauseButton.textContent = bowling3dPaused ? "Resume" : "Pause";
    return;
  }
  startButton.disabled = false;
  restartButton.disabled = false;
  playerScore.textContent = isSnake ? snake.score : pong.scores[1];
  opponentScore.textContent = isSnake ? "" : pong.scores[2];
  scoreDivider.textContent = isSnake ? "" : ":";
  if (isSnake && snake.gameOver) {
    message.textContent = "Game over";
    message.classList.add("visible");
  } else if (!isSnake && pong.gameOver) {
    message.textContent = `Player ${pong.winner} wins`;
    message.classList.add("visible");
  } else if (!isSnake && pong.pauseRemaining > 0) {
    message.textContent = `Player ${pong.lastScorer} scores`;
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
  pauseButton.textContent = activeGame.paused ? "Resume" : "Pause";
  pauseButton.disabled = !activeGame.running || activeGame.gameOver || (!isSnake && pong.pauseRemaining > 0);
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
  if (activeGame) activeGame.update((now - lastTime) / 1000);
  lastTime = now;
  if (gameType === "pong" && pong.goalSequence !== seenGoalSequence) {
    seenGoalSequence = pong.goalSequence;
    celebrateGoal();
  }
  if (activeGame) activeGame.draw();
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
