import { Game } from "./game/Game.js";
import "./styles/main.css";

const canvas = document.querySelector("#game-canvas");
const game = new Game(canvas);
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const modeButton = document.querySelector("#mode-button");
const message = document.querySelector("#message");
const modeLabel = document.querySelector("#mode-label");
const playerScore = document.querySelector("#player-score");
const opponentScore = document.querySelector("#opponent-score");
const gameShell = document.querySelector(".game-shell");
const pressedKeys = new Set();
let lastTime = performance.now();
let seenGoalSequence = 0;

const keyToInput = {
  KeyA: [1, -1],
  KeyD: [1, 1],
  KeyJ: [2, -1],
  KeyL: [2, 1],
};

function updateKeyboardInput() {
  for (const playerId of [1, 2]) {
    const up = [...pressedKeys].some((key) => keyToInput[key]?.[0] === playerId && keyToInput[key][1] < 0);
    const down = [...pressedKeys].some((key) => keyToInput[key]?.[0] === playerId && keyToInput[key][1] > 0);
    game.setPaddleInput(playerId, up === down ? 0 : (up ? -1 : 1));
  }
}

window.addEventListener("keydown", (event) => {
  if (keyToInput[event.code]) {
    event.preventDefault();
    pressedKeys.add(event.code);
    updateKeyboardInput();
  }
  if (event.code === "Space" && !game.running) game.start();
  if (event.code === "KeyP" || event.code === "Escape") game.togglePause();
});

window.addEventListener("keyup", (event) => {
  if (keyToInput[event.code]) {
    pressedKeys.delete(event.code);
    updateKeyboardInput();
  }
});

startButton.addEventListener("click", () => game.start());
pauseButton.addEventListener("click", () => game.togglePause());
restartButton.addEventListener("click", () => game.restart());
modeButton.addEventListener("click", () => {
  game.setMode(game.mode === "single" ? "two-player" : "single");
  updateModeUI();
});

function updateModeUI() {
  const twoPlayer = game.mode === "two-player";
  modeButton.textContent = twoPlayer ? "1P MODE" : "2P MODE";
  modeLabel.textContent = twoPlayer ? "2P // LOCAL BATTLE" : "1P // VS AI";
}

function updateUI() {
  playerScore.textContent = game.scores[1];
  opponentScore.textContent = game.scores[2];
  if (game.gameOver) {
    message.textContent = `PLAYER ${game.winner} WINS`;
    message.classList.add("visible");
  } else if (game.pauseRemaining > 0) {
    message.textContent = `PLAYER ${game.lastScorer} SCORES`;
    message.classList.add("visible");
  } else if (game.paused) {
    message.textContent = "GAME PAUSED";
    message.classList.add("visible");
  } else if (!game.running) {
    message.textContent = "PRESS START";
    message.classList.add("visible");
  } else {
    message.classList.remove("visible");
  }
  pauseButton.textContent = game.paused ? "RESUME" : "PAUSE";
  pauseButton.disabled = !game.running || game.gameOver || game.pauseRemaining > 0;
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
    piece.style.backgroundColor = index % 2 ? "#ff64d8" : "#64f4ff";
    gameShell.append(piece);
    window.setTimeout(() => piece.remove(), 1100);
  }
}

function frame(now) {
  game.update((now - lastTime) / 1000);
  lastTime = now;
  if (game.goalSequence !== seenGoalSequence) {
    seenGoalSequence = game.goalSequence;
    celebrateGoal();
  }
  game.draw();
  updateUI();
  requestAnimationFrame(frame);
}

updateModeUI();
requestAnimationFrame(frame);

// Stable integration point for future motion adapters.
window.gyroPong = { game, setPaddleInput: (playerId, verticalValue) => game.setPaddleInput(playerId, verticalValue) };
