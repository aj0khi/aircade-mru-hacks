# AIRCADE

**A motion-controlled arcade revival powered by AirPods**

## 1. Project Overview

AIRCADE is a browser-based arcade collection that revitalizes familiar games with a new input method: AirPods head-motion tracking. Players can tilt, roll, and swing naturally, while keyboard controls keep every cabinet playable without special hardware.

The goal is to transform familiar arcade games into an accessible, social gaming experience using consumer hardware that players may already own. The shared cabinet brings together classic Pong, Snake, and Breakout presentations with 3D Bowling and Neon Tanks.

The default bowling cabinet is our first-party Canvas game, **AIRCADE
Bowling**. It uses our own renderer and game shell, while adapting selected
physics structures from the borrowed Three.js/Ammo.js lane: lane dimensions,
ball and pin mass/inertia values, rigid-body shapes, friction, gravity, fixed
time stepping, and transform-based motion. The adapted physics code is marked
in [`src/game/Bowling.js`](./src/game/Bowling.js) and remains covered by the
included GPLv3 license and attribution. The borrowed lane remains available
as **3D Bowling // Fallback** while the original design is evaluated.

**Hackathon theme:** Revitalization

**Judging criteria:**
- Coolness
- Uniqueness
- Usefulness

**Core idea:** Revitalize a classic arcade game by reinventing how people physically interact with it.

## Current project status

This is a macOS-first prototype. The browser games can be played with a
keyboard, but live AirPods motion requires a Mac, Xcode, compatible AirPods,
CoreMotion, and the local motion bridge. Windows and Linux support are not
project goals right now.

### Current weak points

These are the main limitations to address before calling the project
production-ready:

1. **Motion setup is still technical.** The bridge requires a local WebSocket
   relay and a macOS development environment; first-time players need clearer
   pairing and calibration guidance.
2. **The games are not equally motion-enabled.** Pong, Snake, Breakout,
   Bowling, and Tanks all accept AirPods motion; Tanks still uses keyboard
   for player 2.
3. **Bowling has the most fragile lifecycle.** It loads separate Three.js,
   Ammo.js, and GLTF assets inside an iframe, so asset or WebGL failures need
   clearer player-facing error states.
4. **The arcade is mostly local play.** It has local multiplayer in selected
   games, but no persistent scores, tournament flow, player profiles, or
   online multiplayer yet.
5. **Automated coverage is limited.** Build validation exists, but browser
   smoke tests for game switching, motion connection, and Bowling startup are
   still needed.
6. **The integration layer is centralized.** [`src/main.js`](./src/main.js)
   currently coordinates game selection, motion, Bowling, controls, and UI,
   which makes larger team changes more conflict-prone.
7. **Third-party Bowling code is vendored.** The project must preserve the
   included GPLv3 license and attribution when the combined application is
   distributed.

These limitations do not invalidate the revitalization concept. They define
the next polish and reliability milestones.

## Platform scope

AIRCADE is intentionally **macOS-only for live motion controls**.

- **Required for AirPods motion:** macOS, Xcode, compatible AirPods, and
  `CMHeadphoneMotionManager`.
- **Browser:** a modern browser on macOS running the local Vite app.
- **Fallback:** keyboard, mouse, and trackpad controls allow development and
  demonstration without AirPods.
- **Not currently supported:** Windows or Linux motion bridges.

Do not plan cross-platform motion support for the current milestone. Keeping
the native bridge focused on macOS lets the team validate the core experience
without adding unrelated platform complexity.

## Run on another Mac

Everything needed is in this repo (`main` branch). There is no prebuilt `.app` in git.

**Prerequisites:** macOS 14+, [Node.js](https://nodejs.org/) 18+, and Xcode (only required for AirPods motion).

```bash
git clone https://github.com/aj0khi/revitilization-hacks.git
cd revitilization-hacks
git checkout main
git pull
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`). Keyboard play works immediately.

For AirPods motion on that Mac:

1. Pair AirPods to **this** Mac (Bluetooth), not the iPhone.
2. Open `motion-bridge/HeadPilotSender.xcodeproj` in Xcode.
3. Select the **HeadPilotSender** scheme, destination **My Mac**.
4. Signing & Capabilities: choose your Apple ID team.
5. Run. Allow **Motion** if macOS asks.
6. Wear the buds. Samples in the sender window should increase.
7. In the arcade, click **Connect motion**.

Look straight ahead and click **Recenter** in the sender if nod/look feels stuck at ±1.

## 2. Core Features

### MVP — Must Have

- Playable Pong game with responsive paddle movement and ball physics.
- Single-player mode against a basic AI opponent.
- Local two-player mode on one computer.
- AirPods head-motion input for at least one player.
- Keyboard controls as a fallback.
- Start screen, score display, win condition, and restart button.
- Keyboard and browser motion APIs so development can continue without AirPods
  connected.

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

The game is developed and demonstrated on macOS for this project. Live AirPods
motion tracking runs through the native Mac bridge.

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

These numbers are illustrative. The implemented browser receiver listens on
`ws://127.0.0.1:8787` by default. Start your local WebSocket relay, then run:

```js
window.gyroArcade.connectMotionBridge("ws://127.0.0.1:8787");
```

The reusable macOS adapter is in
[`motion-bridge/HeadPilotMotion.swift`](./motion-bridge/HeadPilotMotion.swift).
It converts `CMHeadphoneMotionManager` values into the normalized `roll`,
`pitch`, and `swing` contract without coupling Core Motion to any game.

Requirements:

- Use a timestamp so stale readings can be detected.
- Stream frequently enough for responsive movement, ideally around 30–60 updates per second if supported reliably.
- Avoid printing every sample to the terminal.
- Keep the connection local for the initial prototype.
- Treat macOS and Xcode as prerequisites for the live AirPods bridge.
- Handle disconnects gracefully.
- Never let a stale motion reading continue moving a paddle indefinitely.

The browser drops stale motion back to neutral after 300 ms without a valid
sample, so a disconnected bridge cannot leave a paddle moving forever.

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

1. Launch AIRCADE.
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

Open the local URL printed by Vite. The first screen is the cabinet selector:
choose a game with the on-screen buttons or keys **1** through **5**. Once
inside a game, **ARCADE MENU** returns to the selector and the adjacent game
button switches directly to the next cabinet without a page reload. Pong uses
the original black-and-white two-paddle presentation. Use **W/S** for Player 1,
**Up/Down** for Player 2, and choose **2P MODE** for local multiplayer. Press
**P** or **Escape**, or click **PAUSE**, to pause and resume. In single-player
mode, Player 2 is controlled by the built-in AI. The browser integration point
is `window.gyroPong.setPaddleInput(playerId, verticalValue)`, where
`verticalValue` is normalized to `-1...1`. In Wii Remote mode, wrist roll moves
Player 1's paddle through
`window.gyroArcade.setMotionSample({ roll, pitch, swing })`.

## 3D Bowling mode

The arcade's **AIRCADE BOWLING** cabinet is a deeply customized 3D lane. We
kept the proven Ammo/Bullet rigid-body and scoring foundations, then rebuilt the
experience around them: HeadPilot HUD and frame display, neon rails and foul
line, custom lighting and camera composition, power feedback, keyboard aiming,
keyboard roll, pointer drag input, AirPods motion, and a non-blocking game-over
flow. The browser integration point is:

```js
window.gyroBowling.setMotionInput(rollValue, swingValue)
```

Both values are normalized to `-1...1`. The controller is assumed to be held
like a Wii Remote: left/right wrist roll maps to `rollValue`, while a distinct
forward swing maps to `swingValue`. The parent arcade forwards these samples to
the 3D physics scene.

For a bridge that sends timestamped samples, use the flick-style adapter:

```js
window.gyroBowling.calibrate({ roll: 0, pitch: 0, swing: 0 });
window.gyroBowling.setMotionSample({
  roll: normalizedRoll,
  pitch: normalizedPitch,
  swing: normalizedForwardSwing,
  timestamp: performance.now()
});
```

`horizontal` and `forward` are still accepted as compatibility aliases for
`roll` and `swing`.

The remaining physics foundation is a local port of the open-source
[iliagrigorevdev/bowling](https://github.com/iliagrigorevdev/bowling) project.
The HeadPilot-specific scene dressing, HUD, controls, status lifecycle, and
motion forwarding are maintained in this repository. The original project is
GPLv3; its license and attribution remain included at
`public/bowling-3d/LICENSE`.

The customized lane is vendored under `public/bowling-3d/` so the normal Vite
server can load it without a second server or npm dependency. The main files
are `index.html` for the HeadPilot cabinet layer, `js/bowlchallenge.js` for
scene composition, HUD, input, and game flow, `js/bowlphysics.js` for the
adapted rigid-body simulation, and `js/scores.js` for frame scoring.

Use the mouse or trackpad to drag the ball left/right, then flick forward to
release it. **Left/Right** aims and **Space** performs a controlled keyboard
roll. **START GAME** resumes the lane, **PAUSE** freezes physics, and
**RESTART** loads a fresh frame. Because this mode includes GPLv3 software,
review the license obligations before distributing the combined application.
AirPods motion is supported through the parent
`window.gyroBowling.setMotionSample()` contract.

After each goal, play pauses briefly while the scoring player is shown, with a screen shake and confetti celebration before the next serve.

## Snake

Use the **SNAKE** button to switch to the second arcade game. Start with the
button or Space, steer with the arrow keys or motion input, pause with
P/Escape, and restart with RESTART. The original-inspired presentation uses a
cartoon snake and apple; a deadzone prevents motion jitter. Hitting the wall or
yourself ends the round. The direct motion API is
`window.gyroSnake.setDirection(roll, pitch)`.

## Breakout

Use the **BREAKOUT** cabinet or press **4** from the game menu. Start with
the button or Space, move the paddle with the left/right arrow keys or wrist
roll, pause with P/Escape, and restart with RESTART. Clear the classic colored
brick wall to finish the round. The direct motion API is
`window.gyroBreakout.setPaddleInput(value)`, where `value` is normalized to
`-1...1`.

## Neon Tanks

Choose **NEON TANKS** or press **5** from the game menu. Player 1 drives with
the arrow keys and fires with Space, or with AirPods: nod up to drive, nod
down to reverse, look left/right to turn, and tilt (roll) to shoot. Player 2
drives with W/A/S/D and fires with F. Shots ricochet off the arena walls and
can break bronze cover after three hits. The first tank hit wins the round.
