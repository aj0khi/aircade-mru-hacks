import { Game } from "./game/Game.js";
import { Snake } from "./game/Snake.js";
import { Bowling } from "./game/Bowling.js";
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
const pressedKeys = new Set();
const pong = new Game(canvas);
const snake = new Snake(canvas);
const bowling = new Bowling(canvas);
let activeGame = pong;
let gameType = "pong";
let lastTime = performance.now();
let seenGoalSequence = 0;

const keyToInput = {
  KeyW: [1, -1],
  KeyS: [1, 1],
  ArrowUp: [2, -1],
  ArrowDown: [2, 1],
};

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
  if (gameType === "bowling" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
    bowling.handleKey(event.code);
  }
  if (event.code === "Space" && !activeGame.running) {
    activeGame.start();
    if (gameType === "bowling") bowling.throwBall();
  }
  if (event.code === "KeyP" || event.code === "Escape") activeGame.togglePause();
});

window.addEventListener("keyup", (event) => {
  if (keyToInput[event.code]) {
    pressedKeys.delete(event.code);
    updateKeyboardInput();
  }
});

startButton.addEventListener("click", () => activeGame.start());
pauseButton.addEventListener("click", () => activeGame.togglePause());
restartButton.addEventListener("click", () => activeGame.restart());
modeButton.addEventListener("click", () => {
  pong.setMode(pong.mode === "single" ? "two-player" : "single");
  updateModeUI();
});
gameButton.addEventListener("click", () => {
  gameType = gameType === "pong" ? "snake" : gameType === "snake" ? "bowling" : "pong";
  activeGame = gameType === "pong" ? pong : gameType === "snake" ? snake : bowling;
  activeGame.reset();
  updateModeUI();
});

function updateModeUI() {
  const twoPlayer = pong.mode === "two-player";
  const snakeMode = gameType === "snake";
  const bowlingMode = gameType === "bowling";
  gameTitle.textContent = snakeMode ? "NEON SNAKE" : bowlingMode ? "GYRO BOWLING" : "SOCCER PONG";
  gameSubtitle.textContent = snakeMode
    ? "Eat, grow, and own the grid."
    : bowlingMode ? "Aim with your head. Roll for the strike." : "A quick match. First to seven.";
  gameButton.textContent = snakeMode ? "BOWLING" : bowlingMode ? "SOCCER PONG" : "SNAKE";
  modeButton.hidden = snakeMode || bowlingMode;
  modeLabel.textContent = snakeMode || bowlingMode ? "ARCADE // SOLO" : (twoPlayer ? "2P // LOCAL BATTLE" : "1P // VS AI");
  canvas.setAttribute("aria-label", snakeMode ? "Neon Snake playing field" : bowlingMode ? "Gyro Bowling lane" : "Horizontal soccer pitch");
  instructions.innerHTML = snakeMode
    ? "<strong>Move</strong> Arrow Keys <span aria-hidden=\"true\">·</span> P / Esc pauses <span aria-hidden=\"true\">·</span> Eat the gold food"
    : bowlingMode
      ? "<strong>Aim</strong> ← / → <span aria-hidden=\"true\">·</span> Power ↑ / ↓ <span aria-hidden=\"true\">·</span> Space throws <span aria-hidden=\"true\">·</span> Tilt to aim, swing forward to roll"
      : "<strong>Player 1</strong> W / S <span aria-hidden=\"true\">·</span> <strong>Player 2</strong> ↑ / ↓ <span aria-hidden=\"true\">·</span> P / Esc pauses <span aria-hidden=\"true\">·</span> First to 7 wins";
}

function updateUI() {
  const isSnake = gameType === "snake";
  const isBowling = gameType === "bowling";
  playerScore.textContent = isSnake ? snake.score : isBowling ? bowling.score : pong.scores[1];
  opponentScore.textContent = isSnake || isBowling ? "" : pong.scores[2];
  scoreDivider.textContent = isSnake || isBowling ? "" : ":";
  if (isSnake && snake.gameOver) {
    message.textContent = "GAME OVER";
    message.classList.add("visible");
  } else if (isBowling && bowling.gameOver) {
    message.textContent = bowling.message;
    message.classList.add("visible");
  } else if (isBowling && bowling.ball) {
    message.classList.remove("visible");
  } else if (isBowling && bowling.message) {
    message.textContent = bowling.message;
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
  pauseButton.disabled = !activeGame.running || activeGame.gameOver || (!isSnake && !isBowling && pong.pauseRemaining > 0);
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
  activeGame.update((now - lastTime) / 1000);
  lastTime = now;
  if (gameType === "pong" && pong.goalSequence !== seenGoalSequence) {
    seenGoalSequence = pong.goalSequence;
    celebrateGoal();
  }
  activeGame.draw();
  updateUI();
  requestAnimationFrame(frame);
}

updateModeUI();
requestAnimationFrame(frame);

// Stable integration point for future motion adapters.
window.gyroPong = { game: pong, setPaddleInput: (playerId, verticalValue) => pong.setPaddleInput(playerId, verticalValue) };
window.gyroBowling = {
  game: bowling,
  setAimInput: (horizontalValue) => bowling.setAimInput(horizontalValue),
  setMotionInput: (horizontalValue, forwardValue) => bowling.setMotionInput(horizontalValue, forwardValue),
  throwBall: (power) => bowling.throwBall(power),
};
