# AirPods motion testing and how the games should use it

This note explains what `AirPodsMotionTest` actually measures, what that is based on, and how AIRCADE should consume those values. It is not a claim that AirPods give a true X/Y position in the room.

## What the tester is based on

The iOS app uses only Apple's public Core Motion headphone API:

- Framework: `CoreMotion`
- Class: `CMHeadphoneMotionManager`
- Sample type: `CMDeviceMotion`

It does **not** use `CMMotionManager`. That class is iPhone motion, not AirPods.

Each live sample reads nine values:

| Display | API | Unit |
|---|---|---|
| Pitch, roll, yaw | `attitude.pitch`, `attitude.roll`, `attitude.yaw` | degrees (converted from radians) |
| Gyro X, Y, Z | `rotationRate.x/y/z` | rad/s |
| Accel X, Y, Z | `userAcceleration.x/y/z` | g |

Two extra numbers are derived, not invented:

- Angular speed = `sqrt(gyroX² + gyroY² + gyroZ²)`
- Acceleration magnitude = `sqrt(accelX² + accelY² + accelZ²)`

The Left/Right selector is only a label for which bud you meant to move. Core Motion has one headphone stream. The app does not switch sensors by ear. If Core Motion reports `sensorLocation`, that is shown separately and is not taken from the selector.

Calibration copies the current `CMAttitude` and uses `multiply(byInverseOf:)` so relative pitch/roll/yaw are a real attitude change, not naive degree subtraction.

If no new sample arrives for 2 seconds, the UI shows `NO LIVE HEADPHONE MOTION DATA` and stops treating old numbers as current.

CSV export writes only samples that actually arrived.

## What we know from running it

Verified on a physical iPhone with AirPods 4, after trusting the developer certificate and allowing Motion:

- Headphone motion is available while the buds are in use.
- Live pitch, roll, yaw, gyro, and accel update.
- The tester is a hardware check. It is not connected to the browser games.

Still experimental, and should be decided from CSV / direction tests rather than assumed:

- Which axis matches LEFT, RIGHT, UP, DOWN for *this* pair of buds.
- Whether handheld motion keeps flowing after you take a bud out. The guided test only reports freshness. It does not prove handheld tracking is a supported Apple feature.
- macOS vs iPhone: the arcade README's live bridge is meant to be a Mac app using the same `CMHeadphoneMotionManager` class. The iOS tester proved the sensors. The Mac WebSocket sender in `motion-bridge/` is still a library, not a running server.

## What these numbers mean for a game

Do not try to reconstruct a room-space X/Y from acceleration. `userAcceleration` is a short push. Integrating it twice drifts immediately.

Use the sensors as two controls:

1. **Aim** from orientation (where the bud is pointing after calibrate).
2. **Hit / swipe power** from a pulse (how hard it snapped).

Aim is stable while you hold a pose. Power spikes during a flick, then returns to about 0.

Gyro is how fast you are rotating *right now*. It is a bad paddle position. It is a good flick detector.

## How the arcade already expects motion

The browser does not talk to AirPods. It waits for normalized `-1...1` values:

```json
{ "type": "motion", "roll": -0.35, "pitch": 0.12, "swing": 0.04, "timestamp": 1792800000000 }
```

`src/main.js` then:

- subtracts a calibrated neutral
- clamps to `-1...1`
- routes `roll` into Pong / Breakout paddles and bowling aim
- routes `roll` + `pitch` into Snake
- routes `swing` into bowling throw

`motion-bridge/HeadPilotMotion.swift` currently maps:

- `roll` ← `attitude.roll`
- `pitch` ← `attitude.pitch`
- `swing` ← `userAcceleration.z` only

That last choice is too narrow until the direction tests say Z is actually “forward.”

## Opinion: how the games should work

**One mapping for every cabinet.** Keep the existing `{ roll, pitch, swing }` contract. Do not send raw nine-axis JSON into each game. Convert once in the Swift bridge (or a thin JS adapter), then let games stay dumb.

**Calibrate every session.** Neutral = hold still, press calibrate. Game X/Y is relative roll/pitch from that pose, not absolute yaw from north.

**Pick axes from the tester, not from a guess.** Run Test Left / Right / Up / Down (rotation). Whichever attitude channel moves most becomes:

- LEFT/RIGHT → `roll` (horizontal aim)
- UP/DOWN → `pitch` (Snake vertical)

If yaw dominates a left/right turn, map yaw into `roll` instead. Signs should match the tester: if Left produced a negative relative roll, keep that sign and invert in one place if the paddle moves the wrong way.

**Swipe hardness is magnitude, not Z.** For bowling throw and any “how hard” move, use:

- `swing = clamp(accelerationMagnitude / sensitivity, 0, 1)`  
  or the peak of that over ~150–300 ms
- optionally mix in `angularSpeed` if a wrist flick reads better than a shove

Detect a throw when magnitude rises above a threshold and then falls. That is a gesture, not a position.

**Suggested cabinet mapping**

| Game | Aim | Action |
|---|---|---|
| Pong / Breakout | relative roll → paddle | none required |
| Snake | relative roll + pitch → direction | none required; keep a deadzone |
| HeadPilot bowling / 3D bowling | relative roll → aim | peak accel magnitude → throw power |

**Fail safe the same way the tester does.** If samples go stale (~300 ms is already in `main.js`), zero the paddle. Do not let the last tilt keep driving the game.

**Do not depend on two live ears.** Core Motion is one headphone stream. One player, one bud-or-pair as a single controller.

**Handheld is optional flavor, not the plan.** If the handheld test keeps live samples, a Wii-remote-style hold can work in a demo. If it drops, require the buds in-ear. The games should feel the same either way: tilt to aim, flick for power.

## Practical next step

1. Keep using `AirPodsMotionTest` to record a few Left/Right/Up/Down and flick CSVs.
2. Change `HeadPilotMotionNormalizer` so `roll`/`pitch` come from the winning attitude axes and `swing` comes from acceleration magnitude (or angular speed).
3. Finish a small Mac (or iPhone) sender that posts that JSON to `ws://127.0.0.1:8787`.
4. Leave keyboard as the fallback. Motion is an overlay on the same `-1...1` inputs.

The games do not need a physics-accurate AirPod tracker. They need a calibrated stick (tilt) and a swing button (flick hardness).
