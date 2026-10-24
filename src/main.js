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
const gameShell = document.querySelector(".game-shell");
const bowling3dFrame = document.querySelector("#bowling-3d-frame");
const pressedKeys = new Set();
const pong = new Game(canvas);
const snake = new Snake(canvas);
let activeGame = pong;
let gameType = "pong";
let lastTime = performance.now();
let seenGoalSequence = 0;
let latestBowling3dSample = null;
let bowling3dPaused = false;
let motionNeutral = { horizontal: 0, forward: 0 };

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

function calibrateBowlingMotion({ horizontal = 0, forward = 0 } = {}) {
  motionNeutral = {
    horizontal: Number.isFinite(Number(horizontal)) ? Number(horizontal) : 0,
    forward: Number.isFinite(Number(forward)) ? Number(forward) : 0,
  };
}

function forwardBowlingMotion(sample = {}) {
  const horizontal = Number(sample.horizontal) - motionNeutral.horizontal;
  const forward = Number(sample.forward) - motionNeutral.forward;
  if (!Number.isFinite(horizontal) || !Number.isFinite(forward)) return false;
  const normalized = {
    horizontal: Math.max(-1, Math.min(1, horizontal)),
    forward: Math.max(-1, Math.min(1, forward)),
    timestamp: sample.timestamp ?? performance.now(),
  };
  if (gameType === "pong") {
    pong.setPaddleInput(1, normalized.forward);
  } else if (gameType === "snake") {
    updateSnakeMotion(normalized.horizontal, normalized.forward);
  }
  sendBowling3dMotion(normalized);
  return true;
}

function updateSnakeMotion(horizontal, forward) {
  const deadzone = 0.32;
  if (Math.max(Math.abs(horizontal), Math.abs(forward)) < deadzone) return;
  if (Math.abs(horizontal) >= Math.abs(forward)) {
    snake.handleKey(horizontal < 0 ? "ArrowLeft" : "ArrowRight");
  } else {
    snake.handleKey(forward < 0 ? "ArrowUp" : "ArrowDown");
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
  gameType = gameType === "pong"
    ? "snake"
    : gameType === "snake"
      ? "bowling-3d"
      : "pong";
  activeGame = gameType === "pong" ? pong : gameType === "snake" ? snake : null;
  if (activeGame) activeGame.reset();
  bowling3dPaused = false;
  bowling3dFrame.hidden = gameType !== "bowling-3d";
  bowling3dFrame.src = gameType === "bowling-3d" ? "/bowling-3d/index.html" : "about:blank";
  canvas.hidden = gameType === "bowling-3d";
  document.querySelector(".scoreboard").hidden = gameType === "bowling-3d";
  message.hidden = gameType === "bowling-3d";
  updateModeUI();
});

function updateModeUI() {
  const twoPlayer = pong.mode === "two-player";
  const snakeMode = gameType === "snake";
  const bowling3dMode = gameType === "bowling-3d";
  gameTitle.textContent = snakeMode
    ? "NEON SNAKE"
    : bowling3dMode ? "3D BOWLING" : "SOCCER PONG";
  gameSubtitle.textContent = snakeMode
    ? "Eat, grow, and own the grid."
    : bowling3dMode
      ? "Open-source physics lane. Drag and flick to bowl."
      : "A quick match. First to seven.";
  gameButton.textContent = snakeMode
    ? "3D BOWLING"
    : bowling3dMode ? "SOCCER PONG" : "SNAKE";
  modeButton.hidden = snakeMode || bowling3dMode;
  modeLabel.textContent = snakeMode || bowling3dMode
    ? "ARCADE // SOLO" : (twoPlayer ? "2P // LOCAL BATTLE" : "1P // VS AI");
  canvas.setAttribute("aria-label", snakeMode
    ? "Neon Snake playing field"
    : bowling3dMode ? "3D physics bowling game" : "Horizontal soccer pitch");
  instructions.innerHTML = snakeMode
    ? "<strong>Move</strong> Arrow Keys or tilt <span aria-hidden=\"true\">·</span> P / Esc pauses <span aria-hidden=\"true\">·</span> Eat the gold food"
    : bowling3dMode
      ? "<strong>Drag</strong> the ball left/right <span aria-hidden=\"true\">·</span> Flick forward to bowl <span aria-hidden=\"true\">·</span> Physics by Ammo.js"
      : "<strong>Player 1</strong> W / S <span aria-hidden=\"true\">·</span> <strong>Player 2</strong> ↑ / ↓ <span aria-hidden=\"true\">·</span> P / Esc pauses <span aria-hidden=\"true\">·</span> First to 7 wins";
}

function updateUI() {
  const isSnake = gameType === "snake";
  if (gameType === "bowling-3d") {
    startButton.disabled = false;
    pauseButton.disabled = false;
    restartButton.disabled = false;
    startButton.textContent = "START GAME";
    pauseButton.textContent = bowling3dPaused ? "RESUME" : "PAUSE";
    return;
  }
  startButton.disabled = false;
  restartButton.disabled = false;
  playerScore.textContent = isSnake ? snake.score : pong.scores[1];
  opponentScore.textContent = isSnake ? "" : pong.scores[2];
  scoreDivider.textContent = isSnake ? "" : ":";
  if (isSnake && snake.gameOver) {
    message.textContent = "GAME OVER";
    message.classList.add("visible");
  } else if (!isSnake && pong.gameOver) {
    message.textContent = `PLAYER ${pong.winner} WINS`;
    message.classList.add("visible");
  } else if (!isSnake && pong.pauseRemaining > 0) {
    message.textContent = `PLAYER ${pong.lastScorer} SCORES`;
    message.classList.add("visible");
  } else if (activeGame.paused) {
    message.textContent = "GAME PAUSED";
    message.classList.add("visible");
  } else if (!activeGame.running) {
    message.textContent = "PRESS START";
    message.classList.add("visible");
  } else {
    message.classList.remove("visible");
  }
  pauseButton.textContent = activeGame.paused ? "RESUME" : "PAUSE";
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

updateModeUI();
requestAnimationFrame(frame);

// Stable integration point for future motion adapters.
window.gyroPong = { game: pong, setPaddleInput: (playerId, verticalValue) => pong.setPaddleInput(playerId, verticalValue) };
window.gyroBowling = {
  game: "3d",
  setAimInput: (horizontalValue) => forwardBowlingMotion({ horizontal: horizontalValue, forward: 0 }),
  setMotionInput: (horizontalValue, forwardValue) => forwardBowlingMotion({
    horizontal: horizontalValue,
    forward: forwardValue,
  }),
  setMotionSample: forwardBowlingMotion,
  calibrate: calibrateBowlingMotion,
  throwBall: (power = 1) => forwardBowlingMotion({ horizontal: 0, forward: power }),
};
window.gyroSnake = {
  setDirection: (horizontalValue, forwardValue) => updateSnakeMotion(
    Number(horizontalValue),
    Number(forwardValue),
  ),
};
window.gyroArcade = {
  setMotionSample: forwardBowlingMotion,
  calibrate: calibrateBowlingMotion,
};
