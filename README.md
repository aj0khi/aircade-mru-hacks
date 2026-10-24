# GYRO PONG — HeadPilot Arcade

**A motion-controlled arcade revival powered by AirPods**

## 1. Project Overview

Gyro Pong is a modern, multiplayer revival of classic Pong. Instead of relying exclusively on a keyboard or physical game controller, players can use AirPods head-motion tracking to control their paddles.

The goal is to transform a familiar arcade game into a new, accessible, social gaming experience using consumer hardware that players may already own.

**Hackathon theme:** Revitalization

**Judging criteria:**
- Coolness
- Uniqueness
- Usefulness

**Core idea:** Revitalize a classic arcade game by reinventing how people physically interact with it.

## 2. Core Features

### MVP — Must Have

- Playable Pong game with responsive paddle movement and ball physics.
- Single-player mode against a basic AI opponent.
- Local two-player mode on one computer.
- AirPods head-motion input for at least one player.
- Keyboard controls as a fallback.
- Start screen, score display, win condition, and restart button.
- Motion simulation mode so development can continue without AirPods connected.

### Stretch Goals — If Time Allows

- Two players using separate AirPods motion streams.
- Gyroscope-powered special moves, such as a charged shot or ball curve.
- Sound effects and music.
- Best-of-three tournament mode.
- Persistent high scores.
- Polished retro arcade visuals and animations.
- Adjustable sensitivity and motion calibration.

**Priority:** A stable, fun game with one working AirPods input stream is more important than many unfinished features.

## 3. Recommended Technology Stack

### Game
- HTML5
- CSS3
- JavaScript
- HTML Canvas for rendering
- Vite for local development

### AirPods Motion Bridge
- Swift
- Apple's CoreMotion framework
- `CMHeadphoneMotionManager`
- Local WebSocket connection between the native macOS bridge and browser game

### Testing and Collaboration
- Git and GitHub
- VS Code
- Node.js and npm
- macOS for live AirPods motion testing

The game is hosted and demonstrated on macOS for this project. Live AirPods motion tracking runs through the native Mac bridge; Windows-native motion compatibility is out of scope.

## 4. System Architecture

```text
AirPods
   |
   v
CoreMotion / Swift Bridge (Mac)
   |
   v
Local WebSocket Connection
   |
   v
JavaScript Motion Controller
   |
   v
Paddle Movement / Special Moves
   |
   v
Canvas Game Engine
```

Keyboard input should use the same game-control interface as AirPods input. This prevents the game engine from depending directly on a specific input device.

## 5. Team Assignments

Three contributors should work on separate modules with clear ownership.

### Contributor 1 — Game Engine and Gameplay

**Owns:** `src/game/`, `src/main.js`, and the main game loop.

Responsibilities:

- Create the Pong playing field.
- Implement paddle and ball movement.
- Implement collision detection and ball reflection.
- Implement scoring and win conditions.
- Create a simple AI opponent.
- Implement local two-player keyboard controls.
- Add a restart mechanism.
- Expose a clean API for other modules to control paddles.

Suggested files:

```text
src/game/Game.js
src/game/Paddle.js
src/game/Ball.js
src/game/Physics.js
src/game/AI.js
src/main.js
```

**Deliverable:** A fully playable Pong game using keyboard controls, independent of AirPods.

### Contributor 2 — AirPods Motion Bridge

**Owns:** `motion-bridge/`.

Responsibilities:

- Read headphone motion using `CMHeadphoneMotionManager`.
- Read yaw, pitch, roll, and rotation-rate values.
- Stream motion data from the Mac to the browser through a local WebSocket connection.
- Send normalized motion data at a practical rate.
- Implement connection status and error handling.
- Provide a simulation mode or test script for development.
- Document how to launch the bridge and grant any required macOS permissions.

Suggested files:

```text
motion-bridge/
├── HeadPilotMotion.swift
├── package.json
└── README.md
```

The exact files may differ depending on the implementation.

**Deliverable:** A working Mac-based motion stream that another module can consume without needing to know how CoreMotion works.

**Important:** Start by validating that the live AirPods stream works reliably. The motion bridge should not be coupled to Pong's physics or rendering code.

### Contributor 3 — Interface, Visual Design, and Integration

**Owns:** `src/ui/`, `src/input/`, `src/styles/`, and project-level integration documentation.

Responsibilities:

- Design a retro arcade start screen.
- Build the game HUD and score display.
- Add game mode selection.
- Create connection indicators for AirPods input.
- Implement sensitivity and calibration controls.
- Build the shared input adapter that accepts both keyboard and motion data.
- Connect the motion bridge to the game engine through a documented interface.
- Add instructions for launching the complete game.

Suggested files:

```text
src/ui/Menu.js
src/ui/HUD.js
src/input/KeyboardInput.js
src/input/MotionInput.js
src/input/InputManager.js
src/styles/main.css
```

**Deliverable:** A polished interface and a unified input layer that allows the game engine to switch between keyboard and AirPods input.

## 6. Shared Input Contract

All three contributors must agree on the input interface before building their modules.

The game engine should receive normalized paddle-control values, not raw AirPods sensor readings.

Example input object:

```js
{
  playerId: 1,
  source: "airpods",
  vertical: 0.35,
  connected: true
}
```

Rules:

- `playerId`: identifies the controlled player.
- `source`: `"airpods"` or `"keyboard"`.
- `vertical`: normalized control value between `-1` and `1`.
- `connected`: indicates whether the source is active.

The precise mapping between head motion and paddle position should be configurable. Use a calibrated neutral position, adjustable sensitivity, and smoothing to avoid jitter.

The game engine should expose an interface similar to:

```js
game.setPaddleInput(playerId, verticalValue);
```

This is a proposed contract. Confirm it with the team before implementation and keep the interface stable once agreed upon.

## 7. Motion Protocol

The Swift bridge should send one JSON message per motion sample over WebSocket.

Example:

```json
{
  "type": "motion",
  "playerId": 1,
  "yaw": -5.8,
  "pitch": 8.8,
  "roll": -6.1,
  "rotationZ": 0.027,
  "timestamp": 1792800000000
}
```

These numbers are illustrative.

Requirements:

- Use a timestamp so stale readings can be detected.
- Stream frequently enough for responsive movement, ideally around 30–60 updates per second if supported reliably.
- Avoid printing every sample to the terminal.
- Keep the connection local for the initial prototype.
- Treat macOS and Xcode as prerequisites for the live AirPods bridge.
- Handle disconnects gracefully.
- Never let a stale motion reading continue moving a paddle indefinitely.

The game can use pitch or yaw changes for continuous paddle movement. Rotation rate can be evaluated for a special move, but its axis and gesture thresholds must be validated experimentally.

## 8. Suggested Repository Structure

```text
gyro-pong/
├── index.html
├── package.json
├── README.md
├── motion-bridge/
│   ├── HeadPilotMotion.swift
│   └── README.md
├── src/
│   ├── main.js
│   ├── game/
│   │   ├── Game.js
│   │   ├── Paddle.js
│   │   ├── Ball.js
│   │   ├── Physics.js
│   │   └── AI.js
│   ├── input/
│   │   ├── InputManager.js
│   │   ├── KeyboardInput.js
│   │   └── MotionInput.js
│   ├── ui/
│   │   ├── Menu.js
│   │   └── HUD.js
│   └── styles/
│       └── main.css
└── tests/
```

This is the proposed structure. If the initial repository already has a different structure, adapt it rather than rewriting working code unnecessarily.

## 9. Visual Direction

Aim for a polished retro-futuristic arcade aesthetic:

- Dark background.
- Glowing cyan and magenta accents.
- Bright white ball and paddle trails.
- Smooth animations and responsive controls.
- Clear score display.
- Minimal menus and readable text.
- Subtle sound and visual feedback on collisions.
- A visible AirPods connection indicator.

Avoid excessive effects that obscure the ball or interfere with gameplay.

The game should feel like a modern arcade cabinet, not a generic webpage.

## 10. Development Timeline

### Phase 1 — Establish the foundation

- Create the repository and project scaffold.
- Agree on the input contract and file ownership.
- Get the basic game running with keyboard controls.
- Test the AirPods motion stream independently.

### Phase 2 — Develop in parallel

- Contributor 1 implements game physics and scoring.
- Contributor 2 implements the native motion bridge.
- Contributor 3 builds the UI and input adapter.

Each contributor should commit small, working changes to a separate feature branch.

### Phase 3 — Integrate

- Connect the motion bridge to the input adapter.
- Map calibrated head movement to paddle movement.
- Test keyboard fallback.
- Verify disconnect handling.
- Tune sensitivity, smoothing, and gameplay balance.

### Phase 4 — Polish and demonstrate

- Fix input jitter and gameplay bugs.
- Add sound effects and a satisfying start-to-finish game loop.
- Test on the actual Mac and AirPods.
- Prepare a short live demonstration.
- Keep a keyboard-controlled fallback ready.

## 11. Git Collaboration Rules

- Create one feature branch per contributor.
- Avoid editing another contributor's owned files without coordinating.
- Do not commit generated build folders or dependencies.
- Open pull requests early, even for incomplete modules.
- Integrate small changes frequently.
- Do not merge code that breaks the working game.
- Keep `main` in a runnable state.

Suggested branch names:

```text
feature/pong-engine
feature/airpods-motion-bridge
feature/ui-input-integration
```

## 12. Definition of Done

The project is ready to demonstrate when:

- The game launches from a documented command.
- A player can complete a match against the AI.
- Two players can play locally with keyboard controls.
- At least one player can control a paddle using live AirPods motion on the Mac.
- The controls are responsive and reasonably stable.
- The game handles disconnects without freezing or moving uncontrollably.
- The scoring and restart flow work correctly.
- A person unfamiliar with the project can understand the controls quickly.

## 13. The Demo

The ideal demonstration:

1. Launch Gyro Pong.
2. Show the normal keyboard-controlled game.
3. Connect AirPods and demonstrate head-controlled paddle movement.
4. Challenge a teammate to a match.
5. Demonstrate one distinctive gyroscope-powered special move if it is stable.
6. Explain how the project revitalizes a familiar arcade game by giving it a new physical interaction model.

**Final principle:** Make the core experience fun before adding complexity. The project succeeds if the motion controls make people want to play another round, not merely because the technology works.

## 14. Run the browser game

The playable Canvas game is independent of the Swift motion bridge and can be run with keyboard controls:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The game uses a horizontal 16:9 soccer pitch. Use **W/S** for Player 1, **Up/Down** for Player 2, and choose **2P MODE** for local multiplayer. Press **P** or **Escape**, or click **PAUSE**, to pause and resume. In single-player mode, Player 2 is controlled by the built-in AI. The browser integration point is `window.gyroPong.setPaddleInput(playerId, verticalValue)`, where `verticalValue` is normalized to `-1...1`.

## Bowling mode

The arcade also includes **Gyro Bowling**, a ten-frame, two-roll bowling game designed
around the same normalized-input approach as Pong. Keyboard fallback controls are:

- **Left / Right:** aim
- **Up / Down:** adjust throw power
- **Space:** start and throw
- **P / Escape:** pause between throws

The browser integration point is:

```js
window.gyroBowling.setMotionInput(horizontalValue, forwardValue)
```

Both values are normalized to `-1...1`. A motion adapter can map AirPods roll or
head tilt to `horizontalValue` and a forward swing gesture to `forwardValue`.
When `forwardValue` exceeds the throw threshold, the ball rolls. A bridge can
also call `window.gyroBowling.setAimInput(horizontalValue)` continuously and
`window.gyroBowling.throwBall(power)` once a swing is detected.

For a bridge that sends timestamped samples, use the flick-style adapter:

```js
window.gyroBowling.calibrate({ horizontal: 0, forward: 0 });
window.gyroBowling.setMotionSample({
  horizontal: normalizedRoll,
  forward: normalizedForwardSwing,
  timestamp: performance.now()
});
```

This follows the open-source [`iliagrigorevdev/bowling`](https://github.com/iliagrigorevdev/bowling)
interaction idea: position the ball laterally, then release it with a forward flick.
That repository is GPLv3 and uses touch input plus Three.js/Ammo.js physics. The
same source, physics, models, and resources are ported into `public/bowling-3d/`
with the original license preserved. The adapter also forwards the same motion
samples into the 3D physics scene when that mode is active.

The bowling engine remains independent of AirPods, Swift, and the UI. The future
macOS bridge only needs to translate CoreMotion samples into this contract.

### 3D physics bowling

The **3D BOWLING** mode is a complete local port of the original open-source bowling game from
[iliagrigorevdev/bowling](https://github.com/iliagrigorevdev/bowling), including
its Three.js rendering and Ammo.js/Bullet physics. It is vendored under
`public/bowling-3d/` so the normal Vite server can load it without a second
server or npm dependency.

Use the mouse or trackpad to drag the ball left/right, then flick forward to
release it. The original GPLv3 license is included at
`public/bowling-3d/LICENSE`. Because this mode includes GPLv3 software, review
the license obligations before distributing the combined application. AirPods
motion is supported through the parent `window.gyroBowling.setMotionSample()`
contract and is forwarded into the ported 3D physics scene.

After each goal, play pauses briefly while the scoring player is shown, with a screen shake and confetti celebration before the next serve.

## Neon Snake

Use the **SNAKE** button to switch to the second arcade game. Start with the button or Space, steer with the arrow keys, pause with P/Escape, and restart with RESTART. Eat gold food to grow and score; hitting the wall or yourself ends the round.
