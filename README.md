# AIRCADE

**Classic cabinets. AirPods as the controller. Arcade joy, revitalized.**

Hackathon theme: **Revitalize**. Arcade games used to be physical, you walked up, grabbed a stick, and played with your whole body. AIRCADE brings that feeling back by turning **AirPods** into a motion controller for five familiar games, using hardware people already own.

---

## The Problem & Our Solution

**The Problem:** Classic games survived as browser clones, but the *play* got smaller. Keyboard and mouse are convenient. They are not an arcade. The social, physical moment of leaning into a cabinet is gone.

**The Solution:** A neon browser arcade where **nod, look, and roll** steer the games. **Pong**, **Snake**, **Breakout**, **Bowling**, and **Neon Tanks** share one cabinet. Keyboard still works so anyone can play. Motion is the revitalization — same games, a new body language.

---

## Key Features

- **Five cabinets, one lobby.** Pick a game and play in seconds.
- **AirPods head motion.** Nod for Pong, look for Breakout/Snake, roll to throw or shoot, roll again to start after a loss.
- **Keyboard fallback.** Demo-ready even if buds are charging.
- **Local 2P.** Share a Mac: one player on motion, one on keys.

---

## Tech Stack & Architecture

| Layer | Stack |
| --- | --- |
| **Frontend** | **Vite**, vanilla **JavaScript**, **HTML5 Canvas**, neon CSS |
| **Bowling** | **Three.js** + **Ammo.js** physics lane |
| **Native motion** | **Swift**, **CoreMotion**, `CMHeadphoneMotionManager` |
| **Transport** | Local **WebSocket** `ws://127.0.0.1:8787` |

**SDK track:** Built on **Apple CoreMotion** (`CMHeadphoneMotionManager`) — public headphone-motion APIs only, streamed live into the browser. No fake sensors.

```text
AirPods → CoreMotion (Mac sender) → WebSocket → src/main.js → Canvas / 3D lane
```

---

## How We Built It

A weekend of making old games feel new:

- Mapped **one** AirPods stream onto **five** different control schemes.
- Fixed a broken WebSocket handshake so the browser actually stays connected.
- Re-zeroed rest pose so nod/look stay in range instead of pegging at ±1.
- Stopped bowling from auto-throwing when you open the lane; **roll still throws**.
- Kept keyboard as a first-class path so judges can play immediately.

The hard part was not drawing Pong. It was making **head motion feel like a cabinet stick**.

---

## What's Under the Hood

```text
revitilization-hacks/
├── index.html                 # AIRCADE shell
├── src/
│   ├── main.js                # lobby, motion mapping, start-on-roll
│   ├── game/                  # Pong, Snake, Breakout, Tanks, Bowling canvas
│   ├── audio/                 # arcade SFX + music
│   └── styles/main.css
├── public/bowling-3d/         # 3D lane (Three.js / Ammo)
├── motion-bridge/
│   ├── HeadPilotMotion.swift  # CoreMotion → JSON
│   └── HeadPilotSender/       # macOS sender app (Xcode)
└── AirPodsMotionTest/         # iOS motion tester
```

---

## Local Setup

**Prereqs:** macOS 14+, **Node.js 18+**. **Xcode** only if you want AirPods motion. No `.env`.

```bash
git clone https://github.com/aj0khi/revitilization-hacks.git
cd revitilization-hacks
git checkout main
git pull
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173/`). Keyboard play works immediately.

**AirPods (this Mac, not the iPhone):**

```bash
open motion-bridge/HeadPilotSender.xcodeproj
```

Run **HeadPilotSender** → My Mac → your signing team → allow **Motion**. Wear the buds, **Recenter**, then click **Connect motion**.
