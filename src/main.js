import { Game } from "./game/Game.js";
import "./styles/main.css";

const canvas = document.querySelector("#game-canvas");
const game = new Game(canvas);
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const modeButton = document.querySelector("#mode-button");
const message = document.querySelector("#message");
const modeLabel = document.querySelector("#mode-label");
const playerScore = document.querySelector("#player-score");
const opponentScore = document.querySelector("#opponent-score");
const pressedKeys = new Set();
let lastTime = performance.now();

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
});

window.addEventListener("keyup", (event) => {
  if (keyToInput[event.code]) {
    pressedKeys.delete(event.code);
    updateKeyboardInput();
  }
});

startButton.addEventListener("click", () => game.start());
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
  } else if (!game.running) {
    message.textContent = "PRESS START";
    message.classList.add("visible");
  } else {
    message.classList.remove("visible");
  }
}

function frame(now) {
  game.update((now - lastTime) / 1000);
  lastTime = now;
  game.draw();
  updateUI();
  requestAnimationFrame(frame);
}

updateModeUI();
requestAnimationFrame(frame);

// Stable integration point for future motion adapters.
window.gyroPong = { game, setPaddleInput: (playerId, verticalValue) => game.setPaddleInput(playerId, verticalValue) };
