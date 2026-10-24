# HeadPilot Arcade

## Judge Pitch Deck and Live Demo Script

**Theme:** Revitalize  
**Recommended format:** Live browser demonstration with this document as the speaker outline  
**Target length:** 3–4 minutes

> The hackathon asks teams to show what they built rather than present a conventional
> slide deck. Use this document as a timed speaking guide while the app is open.

## 1. The 20-second opening

> Classic arcade games were physical. You stood at a cabinet, grabbed a control,
> and reacted with your whole body. Modern browser games often reduce that feeling
> to a keyboard and a cursor.
>
> We built **HeadPilot Arcade**: a desktop arcade cabinet that brings physical
> motion back to familiar games using Wii Remote-style tilt and swing controls.

Immediately show the running arcade lobby after this line.

## 2. The problem

Modern games are easy to access, but the interaction can feel disconnected:

- Keyboard and mouse controls put distance between the player and the game.
- Motion hardware is difficult to expose cleanly to a browser.
- Classic arcade games had a strong social and physical presence.
- Many modern game interfaces look interchangeable instead of belonging to a place.

### Say this

> We were not only trying to remake old games. We wanted to revitalize the feeling
> of walking up to a machine, choosing a cabinet, grabbing a controller, and
> immediately understanding what to do.

## 3. The solution

HeadPilot Arcade combines:

- **Three playable cabinets:** Soccer Pong, Neon Snake, and 3D Bowling.
- **Immediate fallback controls:** keyboard and mouse work without extra hardware.
- **Motion input:** roll, pitch, and forward swing are normalized into a shared contract.
- **A Mac direction:** Swift/CoreMotion can provide motion samples from supported devices.
- **One cabinet shell:** game titles, scores, instructions, controls, and navigation stay consistent.
- **Direct switching:** players can change games or return to the lobby without reloading.
- **A deliberate visual identity:** CRT texture, fluorescent rails, marquee lettering,
  hard cabinet edges, and restrained old-sign flicker.

## 4. Live demonstration

### Step 1 — Start in the lobby (20 seconds)

Open the app at the game selector.

> The arcade starts with a choice instead of automatically launching one game. This
> makes the experience feel like a cabinet lobby and gives the player agency from
> the first screen.

Point out:

- The three numbered game choices.
- Keyboard shortcuts **1**, **2**, and **3**.
- The HeadPilot Arcade marquee.
- The long fluorescent-style rails.
- The cabinet frame and scanline treatment.

Do not explain every CSS detail. Let the visual language do the work.

### Step 2 — Play Soccer Pong (45 seconds)

Select **Soccer Pong**, press **Start game**, and play a short rally.

> Soccer Pong is our quickest introduction. It takes the readable structure of Pong
> and reframes it as a soccer match: defend your side, aim for the opponent's goal,
> and be the first to seven.

Demonstrate:

- **W/S** for Player 1.
- The computer-controlled opponent.
- The score display.
- The cyan and pink scoring-side cues.
- A goal celebration if one happens naturally.

> The side colors are functional as well as visual. They help players understand
> which goal they defend and where they should aim.

If the motion bridge is connected:

> With a Wii Remote-style grip, wrist roll moves the paddle. The same game remains
> playable with W/S, so the experience is demonstrable even without hardware.

### Step 3 — Switch to Neon Snake (30 seconds)

Click **Switch game** and show the Snake cabinet.

> This is intentionally one arcade rather than three separate pages. The shell
> changes the game, title, score treatment, instructions, and input mapping while
> keeping the player in the same cabinet.

Demonstrate:

- The updated title and instructions.
- Arrow-key movement.
- The changing score.
- The shared neon palette.

Explain the motion mapping:

> For Snake, roll and pitch become directional input instead of continuous paddle
> movement. The hardware sample stays the same; the game interprets it differently.

### Step 4 — Switch to 3D Bowling (35 seconds)

Click the Bowling switch button.

> Bowling shows that the shell can host a different kind of game, including a
> physics-based 3D scene.

Demonstrate:

- Drag to aim.
- A forward flick or click-and-drag release.
- The bowling HUD inside the cabinet.

> Bowling uses roll for aim and a forward swing for the throw impulse. The parent
> arcade owns navigation and motion routing, while the embedded scene owns its
> rendering and physics.

### Step 5 — Return to the lobby (15 seconds)

Click **Arcade menu**.

> A player can leave any game at any time. When Bowling is left, its iframe is
> unloaded so old physics and motion state cannot continue underneath another game.

This is a useful technical detail to mention because it demonstrates game lifecycle
management, not just visual polish.

## 5. Why this revitalizes the arcade

### It revitalizes interaction

The project brings physical movement into a browser:

- Wrist roll moves a Pong paddle.
- Roll and pitch steer Snake.
- Roll aims Bowling.
- Forward swing throws the ball.

### It revitalizes presentation

The browser becomes a recognizable place rather than a generic page:

- Hard-edged cabinet framing.
- CRT-inspired scanlines.
- Long fluorescent light rails.
- Yellow, cyan, pink, and violet signal colors.
- Chunky display lettering.
- A marquee that flickers like an aging arcade sign.
- “Insert coin” language and cabinet-style navigation.

### It revitalizes social play

- Soccer Pong supports local two-player play.
- Friends can take turns on the same cabinet.
- The game lobby makes the whole experience easy to understand during a live demo.
- The repository and browser architecture make collaboration straightforward.

### Say this

> We interpreted “revitalize” as more than putting neon colors on an old game.
> We revitalized the interaction model and the feeling of place: familiar games,
> new physical input, and one shared arcade that invites another round.

## 6. Technical architecture

### Browser layer

The project is a Vite browser application:

| Area | Responsibility |
| --- | --- |
| `index.html` | Accessible cabinet shell and game selection markup |
| `src/main.js` | Game lifecycle, navigation, input routing, and UI state |
| `src/styles/main.css` | Cabinet visual system and responsive layout |
| `src/game/Pong.js` | Soccer Pong physics and rendering |
| `src/game/Snake.js` | Neon Snake rules and rendering |
| `public/bowling-3d/` | Embedded 3D bowling scene and physics |
| `motion-bridge/HeadPilotMotion.swift` | macOS/CoreMotion bridge foundation |

### Shared motion contract

```js
{
  roll: -1..1,
  pitch: -1..1,
  swing: -1..1,
  timestamp
}
```

The fields represent:

- `roll` — left/right wrist tilt.
- `pitch` — upward/downward tilt.
- `swing` — forward acceleration or throw pulse.
- `timestamp` — sample freshness and stale-input handling.

| Motion | Soccer Pong | Neon Snake | 3D Bowling |
| --- | --- | --- | --- |
| Roll | Paddle position | Horizontal direction | Aim |
| Pitch | — | Vertical direction | Available to the scene |
| Swing | — | — | Throw impulse |

### Why normalize the input?

> We did not want to build a completely separate controller for every game.
> A shared contract lets hardware access evolve independently from gameplay.
> Each game can interpret the same physical sample according to its own mechanics.

### Bowling integration

Bowling runs inside a same-origin iframe:

1. The arcade shell selects Bowling.
2. The iframe loads the physics scene.
3. The parent forwards normalized motion with `postMessage`.
4. The bowling scene handles aim, release, and physics.
5. Leaving Bowling unloads the iframe and clears the old session.

This keeps the outer experience consistent without forcing the 3D scene to become
part of the shell's rendering loop.

## 7. Swift and Mac direction

The motion bridge is designed around Swift and CoreMotion:

- `CMHeadphoneMotionManager` supplies supported device motion data.
- Swift normalizes roll, pitch, and swing values.
- Calibration establishes a neutral wrist position.
- Smoothing reduces noisy movement.
- WebSocket messages deliver samples to the browser.
- The browser consumes the same contract regardless of the source device.

### Be precise with judges

> The browser game and keyboard fallback are immediately demonstrable. The Swift
> bridge is the Mac hardware integration path: it gives us a clean boundary between
> device-specific motion access and game-specific browser behavior.

Do not claim that every AirPods model exposes the required motion data. Say that
the bridge is designed for supported CoreMotion headphone hardware.

## 8. Engineering decisions and challenges

### Challenge: browser/hardware boundaries

**Decision:** Separate the Swift bridge from the browser game and communicate with
normalized WebSocket samples.

**Benefit:** The game remains testable without hardware, and hardware support can
improve independently.

### Challenge: one motion model, different mechanics

**Decision:** Keep raw motion consistent and interpret it per game.

**Benefit:** The player learns one physical vocabulary while each game still feels
distinct.

### Challenge: mixing Canvas and 3D

**Decision:** Keep Pong and Snake in the main Canvas and host Bowling as a
same-origin iframe.

**Benefit:** Each game keeps a focused rendering and physics responsibility while
the cabinet controls the shared experience.

### Challenge: preserving intentional design

**Decision:** Use animation selectively. Long fluorescent strips hum; small badges,
status plaques, and game titles stay readable. Only the startup marquee gets the
old-sign dropout effect.

**Benefit:** The cabinet feels alive without becoming visually noisy or
automatically generated.

## 9. What we learned

> Motion input is only valuable when the player understands what the movement means.
> The interface has to explain the grip, the action, and the result.

> A fallback is not a compromise. Keyboard and mouse controls make the project
> easy to test, debug, and demonstrate while the hardware layer is evolving.

> A strong visual system is functional. The cabinet shell gives the player context,
> makes transitions understandable, and turns separate prototypes into one product.

## 10. Current status

### Working

- Cabinet game selector.
- Soccer Pong with single-player AI and local two-player mode.
- Neon Snake.
- 3D Bowling integration.
- Keyboard controls.
- Mouse/trackpad Bowling controls.
- Shared browser motion APIs.
- Swift/CoreMotion bridge foundation.
- Direct in-game game switching.
- Return-to-menu navigation.
- Bowling iframe cleanup on navigation.
- Desktop-first responsive layout.
- Reduced-motion support.

### Next

- In-app motion calibration and sensitivity controls.
- Visible bridge connection and stale-input status.
- Arcade sound effects and music.
- Local high scores and replay flow.
- More games designed around physical movement.
- A polished macOS companion app for pairing and calibration.

## 11. Judge questions and answers

### “Why a browser instead of a native game?”

> The browser made iteration, sharing, and collaboration faster. We reserve the
> native Swift layer for hardware access while keeping the game easy to run.

### “Does motion control work right now?”

> The game exposes the shared motion APIs and the Mac bridge defines the CoreMotion
> path. Keyboard and mouse controls are available as a reliable fallback, so the
> complete experience is still playable without the bridge connected.

### “What did your team build?”

> We built the cabinet shell, menu and navigation, game lifecycle, Pong and Snake
> integration, input router, motion contract, Swift bridge foundation, and visual
> system. The Bowling scene is integrated with its original attribution and license.

### “What makes this more than a visual redesign?”

> The central change is interaction. Roll, pitch, and swing are routed into
> different mechanics, and the project handles calibration, stale input, iframe
> messaging, and game lifecycle in addition to the visual treatment.

### “What would you build next?”

> We would first polish the Mac companion app and calibration experience, then add
> sound, high scores, and games designed specifically around physical movement.

## 12. 45-second emergency version

> This is HeadPilot Arcade, a desktop browser arcade that revitalizes classic games
> through physical motion. It includes Soccer Pong, Neon Snake, and 3D Bowling in
> one early-2000s cabinet-style experience.
>
> Keyboard and mouse controls work immediately, but the input system is designed
> for a Wii Remote-style grip: roll moves Pong, roll and pitch steer Snake, and
> roll plus forward swing controls Bowling. A Swift/CoreMotion bridge provides the
> Mac hardware path, while the browser uses one normalized motion contract.
>
> We did not just copy the neon look of an arcade. We revitalized the interaction:
> players choose a cabinet, move with the controls, switch games, and keep playing
> in one shared machine.

## 13. Final closing line

> HeadPilot Arcade asks what happens when a browser game feels like a place again:
> something you walk up to, choose from, move with, and want to play one more round.

## Demo checklist

Before meeting the judges:

- [ ] Open the Vite app at the desktop viewport.
- [ ] Confirm the lobby shows all three game choices.
- [ ] Select Soccer Pong and start a short match.
- [ ] Show the score and side-color cues.
- [ ] Switch to Snake without reloading.
- [ ] Switch to Bowling and demonstrate drag-to-aim.
- [ ] Return to the Arcade menu.
- [ ] Keep the browser console closed unless explaining a technical detail.
- [ ] If motion hardware is unavailable, use the keyboard fallback confidently.
- [ ] End with the “feels like a place again” closing line.
