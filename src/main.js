import { Game } from "./game/Game.js";
import { Snake } from "./game/Snake.js";
import { Tank } from "./game/Tank.js";
import "./styles/main.css";

const canvas = document.querySelector("#game-canvas");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const modeButton = document.querySelector("#mode-button");
const gameButton = document.querySelector("#game-button");
const gameTitle = document.querySelector("#game-title");
const message = document.querySelector("#message");
const modeLabel = document.querySelector("#mode-label");
const playerScore = document.querySelector("#player-score");
const opponentScore = document.querySelector("#opponent-score");
const scoreDivider = document.querySelector("#score-divider");
const instructions = document.querySelector("#instructions");
const gameShell = document.querySelector(".game-shell");

const pressedKeys = new Set();
const pong = new Game(canvas);
const snake = new Snake(canvas);
const tank = new Tank(canvas);
const games = { pong, snake, tank };
const gameOrder = ["pong", "snake", "tank"];
let gameType = "pong";
let activeGame = pong;
let lastTime = performance.now();
let seenGoalSequence = pong.goalSequence;
let seenWinSequence = tank.winSequence;

const keyToInput = {
  KeyW: [1, -1], KeyS: [1, 1],
  ArrowUp: [2, -1], ArrowDown: [2, 1],
};
const tankKeys = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyF",
]);

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
  if (gameType === "tank" && tankKeys.has(event.code)) {
    event.preventDefault();
    tank.handleKeyDown(event.code);
  }
  // In Tank mode Space is the blue player's fire key, not a start key.
  if (event.code === "Space" && gameType !== "tank" && !activeGame.running) {
    event.preventDefault();
    activeGame.start();
  }
  if (event.code === "Enter" && !activeGame.running && !activeGame.gameOver) {
    activeGame.start();
  }
  if (event.code === "KeyP" || event.code === "Escape") {
    event.preventDefault();
    activeGame.togglePause();
  }
});

window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
  updateKeyboardInput();
  tank.handleKeyUp(event.code);
});
window.addEventListener("blur", () => {
  pressedKeys.clear();
  updateKeyboardInput();
  tank.clearKeys();
});

startButton.addEventListener("click", () => activeGame.start());
pauseButton.addEventListener("click", () => activeGame.togglePause());
restartButton.addEventListener("click", () => {
  activeGame.restart();
  seenGoalSequence = pong.goalSequence;
  seenWinSequence = tank.winSequence;
});
modeButton.addEventListener("click", () => {
  if (gameType !== "pong") return;
  pong.setMode(pong.mode === "single" ? "two-player" : "single");
  pressedKeys.clear();
  updateKeyboardInput();
  seenGoalSequence = pong.goalSequence;
  updateModeUI();
});
gameButton.addEventListener("click", () => {
  const next = (gameOrder.indexOf(gameType) + 1) % gameOrder.length;
  gameType = gameOrder[next];
  activeGame = games[gameType];
  pressedKeys.clear();
  updateKeyboardInput();
  tank.clearKeys();
  activeGame.reset();
  seenGoalSequence = pong.goalSequence;
  seenWinSequence = tank.winSequence;
  updateModeUI();
});

function updateModeUI() {
  const twoPlayer = pong.mode === "two-player";
  gameTitle.textContent = gameType === "snake" ? "NEON SNAKE" : gameType === "tank" ? "TANK ARENA" : "SOCCER PONG";
  gameButton.textContent = gameType === "pong" ? "SNAKE" : gameType === "snake" ? "TANK ARENA" : "SOCCER PONG";
  modeButton.hidden = gameType !== "pong";
  modeLabel.textContent = gameType === "snake" ? "ARCADE // SOLO" : gameType === "tank" ? "2P // TANK DUEL" : twoPlayer ? "2P // LOCAL BATTLE" : "1P // VS AI";
  canvas.setAttribute("aria-label", gameType === "snake" ? "Neon Snake playing field" : gameType === "tank" ? "Two-player tank arena" : "Horizontal soccer pitch");
  instructions.innerHTML = gameType === "snake"
    ? '<strong>Move</strong> Arrow Keys · <strong>Pause</strong> P / Esc · Eat gold food'
    : gameType === "tank"
      ? '<strong>Blue</strong> ↑ / ↓ move, ← / → turn, Space fire · <strong>Red</strong> W / S move, A / D turn, F fire · <strong>Pause</strong> P / Esc · Bronze walls take 3 hits'
      : '<strong>Player 1</strong> W / S · <strong>Player 2</strong> ↑ / ↓ · P / Esc pauses · First to 7 wins';
}

function updateUI() {
  const isSnake = gameType === "snake";
  const isTank = gameType === "tank";
  playerScore.textContent = isSnake ? snake.score : isTank ? tank.scores[1] : pong.scores[1];
  opponentScore.textContent = isSnake ? "" : isTank ? tank.scores[2] : pong.scores[2];
  scoreDivider.textContent = isSnake ? "" : ":";
  if (activeGame.gameOver) {
    message.textContent = isSnake ? "GAME OVER" : `PLAYER ${activeGame.winner} WINS`;
    message.classList.add("visible");
  } else if (!isSnake && !isTank && pong.pauseRemaining > 0) {
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
  pauseButton.disabled = !activeGame.running || activeGame.gameOver || (gameType === "pong" && pong.pauseRemaining > 0);
}

function celebrateGoal() {
  gameShell.classList.remove("shake");
  void gameShell.offsetWidth;
  gameShell.classList.add("shake");
  for (let index = 0; index < 24; index++) {
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
  activeGame.update((now - lastTime) / 1000);
  lastTime = now;
  if (gameType === "pong" && pong.goalSequence !== seenGoalSequence) {
    seenGoalSequence = pong.goalSequence;
    celebrateGoal();
  }
  if (gameType === "tank" && tank.winSequence !== seenWinSequence) {
    seenWinSequence = tank.winSequence;
    celebrateGoal();
  }
  activeGame.draw();
  updateUI();
  requestAnimationFrame(frame);
}

updateModeUI();
requestAnimationFrame(frame);

// Existing motion-bridge integration remains unchanged.
window.gyroPong = {
  game: pong,
  setPaddleInput: (playerId, verticalValue) => pong.setPaddleInput(playerId, verticalValue),
};
