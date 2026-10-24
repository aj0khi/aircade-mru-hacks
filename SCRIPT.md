# HeadPilot Arcade — Video Script

## Recording brief

**Target length:** 3–4 minutes  
**Format:** Screen recording with voice-over  
**Tone:** Energetic, thoughtful, personal, and clear  
**Audience:** Hackathon judges and developers  
**Primary goal:** Show the working arcade experience instead of describing an idea
abstractly.

This script assumes the browser app is open at a desktop viewport. Keep the arcade
visible as much as possible. Do not use a slide deck during the recording.

## Before recording

- Start the Vite development server.
- Open the arcade at a desktop-sized browser window.
- Close unrelated tabs and notifications.
- Confirm the game lobby appears first.
- Confirm the browser window is large enough to show the cabinet clearly.
- Have the Swift motion bridge ready if available.
- If motion hardware is unavailable, use the keyboard and mouse fallback confidently.
- Keep this script nearby, but do not read every parenthetical instruction aloud.

## Shot list at a glance

| Time | Visual | Purpose |
| --- | --- | --- |
| 0:00–0:15 | Arcade lobby | Establish identity and hook |
| 0:15–0:35 | Lobby and marquee | Explain the problem |
| 0:35–1:15 | Soccer Pong | Show immediate playability |
| 1:15–1:45 | Neon Snake | Show shared shell and motion mapping |
| 1:45–2:25 | 3D Bowling | Show variety and physics |
| 2:25–2:45 | Return to menu | Show lifecycle and navigation |
| 2:45–3:20 | Architecture explanation | Explain the technical work |
| 3:20–3:45 | Closing screen | Connect to Revitalize |

## Full recording script

### Scene 1 — Opening shot: the arcade lobby

**Time:** 0:00–0:15  
**Screen action:** Start on the game selector. Move the pointer slowly across the
three game choices. Do not click yet.

**Narration:**

> Classic arcade games were physical. You walked up to a cabinet, grabbed a
> controller, and reacted with your whole body.
>
> We built **HeadPilot Arcade**, a desktop browser arcade that brings that physical
> feeling back through motion, familiar games, and a cabinet designed to feel like
> a real place.

**Recording note:** Leave enough time for viewers to see “Soccer Pong,” “Neon
Snake,” and “3D Bowling.”

### Scene 2 — The problem and the visual identity

**Time:** 0:15–0:35  
**Screen action:** Keep the lobby visible. Briefly point to the marquee, cabinet
frame, fluorescent rails, and game cards.

**Narration:**

> Modern browser games are convenient, but the interaction can feel disconnected.
> A keyboard and mouse are useful, but they do not always create the physical,
> social feeling of an arcade.
>
> We wanted to revitalize that feeling without making the experience difficult to
> access. So the arcade supports keyboard and mouse controls immediately, while
> also providing a motion-control path designed around holding a controller like a
> Wii Remote.

**Optional narration if time allows:**

> The visual design follows the same idea: hard cabinet edges, CRT-inspired
> scanlines, fluorescent light rails, strong arcade colors, and a marquee that
> flickers like an old sign.

### Scene 3 — Soccer Pong: the fastest introduction

**Time:** 0:35–1:15  
**Screen action:**

1. Click **Soccer Pong**.
2. Click **Start game**.
3. Play a short rally with W/S.
4. If practical, score a goal.
5. Let the score and side-color cues remain visible for a moment.

**Narration:**

> The first cabinet is Soccer Pong. It takes the simple structure of Pong and
> reframes it as a soccer match: defend your side, aim for the opponent’s goal,
> and be the first to seven.
>
> It is immediately playable with W and S, with the computer controlling the
> opposite side. The cyan and pink goal cues help players understand which side
> they are defending and where they should aim.

**If motion hardware is connected:**

> With motion input, wrist roll moves the paddle. The player can hold the device
> naturally and tilt left or right instead of learning a complicated control scheme.

**If motion hardware is not connected:**

> The motion bridge is designed for the physical version, but the keyboard fallback
> means the game remains fully demonstrable and playable without special hardware.

**Recording note:** Do not wait for a complete match. A short rally and one visible
score are enough.

### Scene 4 — Neon Snake: one shell, different mechanics

**Time:** 1:15–1:45  
**Screen action:**

1. Click **Switch game**.
2. Start Snake.
3. Move for several seconds.
4. Show the score increasing if possible.

**Narration:**

> The second cabinet is Neon Snake. The player moves with the arrow keys, collects
> the gold food, and grows the longest line.
>
> The important part is that this is not a separate webpage or a collection of
> unrelated prototypes. The same arcade shell updates the title, instructions,
> score treatment, and controls while keeping the player inside one cabinet.
>
> For motion input, roll and pitch become directional input. The motion sample
> stays consistent, but each game interprets it according to its own mechanics.

**Recording note:** Keep Snake moving smoothly. Avoid intentionally crashing unless
you need a clear transition.

### Scene 5 — 3D Bowling: motion as aim and release

**Time:** 1:45–2:25  
**Screen action:**

1. Click the Bowling switch button.
2. Wait for the 3D lane to load.
3. Aim with drag.
4. Roll the ball with a forward flick or the visible interaction.
5. Show the pins or physics response.

**Narration:**

> The third cabinet is 3D Bowling. This adds a physics-based 3D scene to the same
> arcade experience.
>
> Dragging lets us aim and flicking forward releases the ball. In the motion
> version, roll controls aim and a forward swing becomes the throw impulse.
>
> This demonstrates the flexibility of the cabinet: the shell can host Canvas games
> and a separate physics scene while keeping navigation, styling, and input
> behavior consistent.

**Technical narration while the scene is visible:**

> The bowling game runs inside a same-origin frame. The parent arcade handles
> navigation and forwards normalized motion messages, while the bowling scene
> remains responsible for rendering and physics.

**Recording note:** If the bowling scene takes a moment to load, narrate the
architecture rather than leaving silence.

### Scene 6 — Navigation and cleanup

**Time:** 2:25–2:45  
**Screen action:**

1. Click **Arcade menu**.
2. Pause on the selector.
3. Optionally choose Snake and switch back to Bowling once more if the recording
   needs to make the navigation especially clear.

**Narration:**

> A player can return to the arcade menu from any game or switch directly to the
> next cabinet without reloading the page.
>
> When Bowling is left, the embedded scene is unloaded. That prevents old physics,
> paused state, or motion input from continuing underneath the next game.
>
> This makes the experience feel like one coherent arcade rather than three demos
> placed next to each other.

### Scene 7 — The technical story

**Time:** 2:45–3:20  
**Screen action:** Keep the browser on the lobby or a calm game screen. Do not
switch to an editor unless the event specifically asks for code.

**Narration:**

> The browser application is built with Vite. The main coordinator owns game
> selection, lifecycle, navigation, score updates, and input routing.
>
> Pong and Snake run as Canvas games. Bowling is hosted as a same-origin 3D scene.
> The shared motion contract is normalized to four pieces of information:

```text
roll      left/right wrist tilt
pitch     upward/downward tilt
swing     forward motion or throw pulse
timestamp sample freshness
```

> Pong maps roll to paddle movement. Snake maps roll and pitch to direction.
> Bowling maps roll to aim and swing to release.
>
> The Mac integration path uses Swift and CoreMotion to obtain supported device
> motion, calibrate a neutral position, smooth the samples, and send them to the
> browser over a WebSocket. The browser does not need to know which supported
> device produced the sample; it only needs the shared contract.

**Recording note:** The code block is for the narrator’s reference. Do not paste it
into the recording unless showing the repository is part of the event format.

### Scene 8 — What was difficult

**Time:** 3:20–3:35  
**Screen action:** Return to the lobby or show a quiet game screen.

**Narration:**

> The main challenge was connecting different kinds of input and different kinds of
> games without losing a consistent experience.
>
> We had to separate hardware access from browser gameplay, interpret the same
> motion differently for each game, manage the lifecycle of the 3D iframe, and
> design the cabinet so it felt intentional instead of like a collection of
> generated effects.
>
> The result is a fallback-friendly experience today, with a clear path toward
> richer physical control on the Mac.

### Scene 9 — Closing: connect to Revitalize

**Time:** 3:35–3:50  
**Screen action:** End on the HeadPilot Arcade lobby. Leave the marquee and all
three game choices visible.

**Narration:**

> HeadPilot Arcade revitalizes classic games in two ways.
>
> It revitalizes their **interaction** by bringing tilt, direction, and swing into
> a browser. And it revitalizes their **sense of place** by turning separate games
> into one shared cabinet that feels physical, social, and worth returning to.
>
> We are not trying to replace the arcade. We are asking how that feeling can live
> on in a modern Mac and browser experience.
>
> This is HeadPilot Arcade: choose a cabinet, move with the controls, and play one
> more round.

## Short 90-second version

Use this version if the recording must be brief.

> Classic arcade games were physical. We built HeadPilot Arcade to bring that
> feeling into a modern desktop browser.
>
> The lobby offers Soccer Pong, Neon Snake, and 3D Bowling in one early-2000s
> cabinet-inspired experience. Players can use the keyboard and mouse immediately,
> while the motion system is designed around a Wii Remote-style grip.
>
> In Soccer Pong, wrist roll maps to paddle movement. In Snake, roll and pitch map
> to direction. In Bowling, roll aims and a forward swing throws the ball.
>
> The browser receives a normalized motion contract, so the games can interpret the
> same physical input differently. A Swift/CoreMotion bridge provides the Mac
> hardware path, while keyboard and mouse keep the experience easy to test.
>
> The project also treats the arcade as one product: players can switch games or
> return to the menu without reloading, and leaving Bowling unloads its physics
> scene cleanly.
>
> We interpreted “revitalize” as more than adding neon colors. We revitalized the
> interaction and the sense of place. HeadPilot Arcade makes the browser feel like
> a cabinet again—something you choose from, move with, and want to play one more
> round.

## Voice and camera guidance

### Voice

- Speak slightly slower than a normal conversation.
- Sound excited when introducing the games, but do not rush the technical section.
- Emphasize **physical**, **shared**, **motion**, and **revitalize**.
- Pause after the opening hook and after the final line.

### Cursor

- Move slowly and deliberately.
- Keep the cursor away from the center of the playfield during active gameplay.
- Use the cursor to point out controls only when the narration refers to them.

### Screen

- Use a desktop viewport.
- Keep browser chrome and unrelated applications out of frame where possible.
- Avoid rapidly resizing the window.
- If a game takes time to load, continue narrating rather than cutting immediately.

## Recovery lines

Use these lines if something goes wrong during the recording.

### Game does not start

> The keyboard fallback is still available, so I am going to restart this cabinet
> and continue the demonstration from the shared arcade shell.

### Motion input is unavailable

> The bridge is the hardware path, but the game is intentionally still playable
> without it. I will demonstrate the same game loop with the keyboard controls.

### Bowling takes too long to load

> Bowling is the 3D physics cabinet, so it has a separate scene to initialize.
> While it loads, the important architecture is that the outer cabinet owns
> navigation and forwards motion, while the scene owns its physics.

### A score or collision happens unexpectedly

> That is a useful example of the game being live rather than a pre-rendered
> animation. I will restart the cabinet and show the transition again.

## Final recording checklist

- [ ] The lobby is visible in the opening shot.
- [ ] The three game names are shown clearly.
- [ ] Soccer Pong starts and receives input.
- [ ] Snake is shown through in-game switching.
- [ ] Bowling loads and demonstrates aim or release.
- [ ] The Arcade menu button is shown.
- [ ] The Revitalize connection is stated explicitly.
- [ ] The recording ends on the lobby, not on an error state.
- [ ] The final line is delivered clearly: **“Choose a cabinet, move with the
  controls, and play one more round.”**
