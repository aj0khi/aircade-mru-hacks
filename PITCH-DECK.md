# AIRCADE — Judging Scripts

> **Primary event format:** MRUHacks 2026 live, science-fair-style judging at the team table. **3 minutes presenting and demonstrating + 2 minutes of Q&A.** Show the working app; do **not** use a slide deck. This document is a team rehearsal script, not something to read from the screen while judges are playing.
>
> **Review status:** Proposed judge-facing script, ready for teammate review. Confirm every motion and game claim against the actual demo before delivering it. The archived, longer *recorded-video* script is kept below for reference and has not been updated for the five-game build.

## Live judging: objective and message

**Product name in this repository:** **AIRCADE**.
**Theme:** Revitalize.  
**Main demo:** Judge tries Soccer Pong with compatible AirPods; a teammate plays using keyboard controls.  
**Secondary proof:** Show one other reliably working arcade game only if time permits.  
**Core message:** *Classic games. New ways to play. The same joy of playing together.*

**What the demo proves:** a shared five-game browser arcade, alternative input mappings, a recognizable retro cabinet experience, and local social play. The team is experimenting with head motion and handheld movement of an AirPod. **Do not imply that every game or every hardware mode has been validated end-to-end.**

### 0:00–0:35 — Elevator pitch (speaker 1)

> Remember when gaming was simple? When all you needed was a game and someone to play it with?
>
> Today, we're bringing back that joy of classic arcade gaming—but reinventing how we experience it.
>
> Introducing **AIRCADE**, where we're turning compatible AirPods into motion controllers for classic-inspired games.
>
> Move your head—or, for certain experimental controls, move an AirPod in your hand.
>
> We're revitalizing gaming with new ways to interact and the same joy of playing together.
>
> **But rather than just telling you about it, we'd love for you to experience it.**

**Team note:** This deliberately removes the original pitch's duplicated “We're revitalizing…” sentence. Describe handheld motion as *experimental*, not verified 3D hand tracking. If the AirPods connection is unavailable, replace the offer with an honest fallback demonstration.

### 0:35–1:00 — Invitation, setup, calibration (speakers 2–3)

Ask: **“Would you like to wear the AirPods to play, try our experimental handheld control if it's working, or watch us demonstrate?”**

- Keep the AirPods paired with the Mac in advance. Allow the judge to decline shared in-ear hardware without pressure; have a hygiene-conscious or hands-free-to-watch option.
- Select **Pong**, switch it from **1P / vs computer** to **2P / local** using the mode button, then start a new game. Player 1 is the motion-controlled paddle; Player 2 uses **↑ / ↓**.
- Connect the motion source and calibrate with the participant in their comfortable neutral position, **if the bridge is working**.
- **Give only the gesture that has been tested for this build.** The checked-in browser code currently maps **`roll` to Pong's paddle**, not pitch: “look up / look down” is **not yet a verified instruction**. Demonstrate the correct tilt and direction before making any claim to the judge.

**Short invitation:** “You're Player One. Let's calibrate your comfortable position, and I'll show you the motion that moves your paddle. My teammate is Player Two. Ready?”

### 1:00–2:00 — Judge plays (speaker 1, in short bursts)

Start a short match. Let the judge experience at least one successful rally before narrating. Pause naturally when they are concentrating.

> That's what we love about classic arcade games. You could sit down with a friend or family member, play, compete, and laugh.
>
> But we also wanted to rethink how people interact with those games.
>
> Turning motion into gameplay gives people another way to participate—and lets us explore alternative controls that may suit different players.
>
> **We're not just bringing back an old game. We're giving people a new way to experience the same joy.**

**Delivery note:** These are talking points, not a continuous monologue. React to a successful rally; let the judge have fun. Avoid asserting proven accessibility for particular disabilities without user testing.

### 2:00–2:20 — Show that it is an arcade, not just Pong (speaker 3)

Show **one** other reliable game from the lobby: **Snake, Breakout, Neon Tanks, or Bowling**. Prefer whichever demonstrates variety without a long load or setup. You do not need to show all five.

> Pong is one of five games in the same arcade. We can switch games and interpret the same motion signals differently—from paddle control to directional movement or a throwing gesture.

**Accuracy note:** In the checked-in version, motion routing exists for Pong, Snake, Breakout, and Bowling; **Tank is keyboard-driven**. Bowling's forward-swing control is more difficult to tune. Do not promise a live motion demo in a secondary game unless verified on the actual Mac.

### 2:20–2:45 — Technical explanation and usefulness (speaker 4)

> Here's what's happening behind the scenes. Apple's Core Motion framework exposes orientation and motion data from compatible AirPods. Our Swift motion adapter converts readings into a shared format, and the browser maps those values into game controls.
>
> Beyond gaming, that approach could inspire hands-free computer navigation or interactive learning. We started with an arcade because it's an immediate, social way to explore alternative input.

**Honesty checkpoint:** As supplied, this repository includes a **Swift motion-source/normalizer foundation and a browser WebSocket client**, but **not a complete running native-to-WebSocket sender/server**. Only say “we stream live AirPods into our web games” after that path is integrated and tested end-to-end. If it is still incomplete, use the backup technical explanation in the next section.

### 2:45–3:00 — Closing (speaker 1)

> For us, **Revitalize** means more than bringing back old games. It means finding new ways to enjoy them together.
>
> **We're not just revitalizing the games we grew up with. We're revitalizing the way we play them.**
>
> That's **AIRCADE**. Thank you!

## If live motion integration is not working

Do not simulate hardware data while claiming it comes from AirPods. Show the functioning keyboard arcade, and explain the actual status:

> The browser games and their shared motion-input interface are working. We can test the control mapping using simulated samples. We also built a Swift component that reads and normalizes compatible AirPods motion. Connecting the native motion source to the browser over our local relay is the integration step we're still validating. Here's what we learned from building both sides.

If you have a **genuine prerecorded successful AirPods test**, you may use it as evidence while clearly labeling it prerecorded. Do not claim it's live.

## Two-minute Q&A — quick responses

**Q: What makes this different from existing motion-controlled games?**  
We're not claiming to have invented motion control. We're adapting motion sensors already found in compatible earbuds to a shared browser-game input format, instead of depending on a traditional game controller. The same input can be interpreted differently by different games.

**Q: What's useful about it beyond nostalgia?**  
It's an alternative way to engage with digital experiences, it creates a social activity, and it demonstrates how familiar hardware can be repurposed. Hands-free interfaces and interactive learning are possible future applications—not products we're claiming to have built.

**Q: Does this make games accessible for people with disabilities?**  
It **could** help some people who find hand-operated controllers difficult, provided they can comfortably use the supported motion gestures. Other users might need entirely different inputs. We haven't validated this with disabled participants, so we'd test comfort, calibration, fatigue, and control preferences before making broader accessibility claims.

**Q: Why AirPods instead of a webcam or dedicated controller?**  
Compatible AirPods can expose motion and orientation data directly through Core Motion. They make a useful experiment in reusing existing hardware. The limits include device compatibility, Bluetooth connection reliability, calibration, and the fact that motion sensors do not give us precise absolute hand position.

**Q: Does one earbud control each player independently?**  
No. Our tests found that the public headphone-motion stream exposes one active earbud at a time, rather than two independent motion streams from the same pair. That's why our practical multiplayer setup uses AirPods for one player and keyboard controls for the other.

**Q: Why is bowling harder?**  
Changing orientation is easier to map directly than inferring a forward throw from short acceleration samples. Swing detection needs thresholds and careful calibration to avoid false throws or missed gestures.

**Q: Why have five games?**  
The arcade shows that one input idea can power different mechanics. Pong is easiest to demonstrate, Snake and Breakout offer other input mappings, Tank adds local multiplayer gameplay, and Bowling explores a more challenging physical gesture.

**Q: What's actually working right now?**  
Give a precise live status: which keyboard games work, which simulated motion mappings have been tested, whether the local WebSocket receives **real** AirPods samples, and which handheld gestures are stable. Never treat a planned integration as a finished feature.

## Judge walkthrough and table setup

| Time | Action | Responsible person |
| --- | --- | --- |
| 0:00–0:35 | Elevator pitch and offer participation | Speaker 1 |
| 0:35–1:00 | Fit or offer AirPods, select 2P Pong, connect, calibrate | Speakers 2–3 |
| 1:00–2:00 | Judge plays against a teammate; light narration | Speakers 1–2 |
| 2:00–2:20 | Show one additional stable game | Speaker 3 |
| 2:20–2:45 | Explain Core Motion, shared input, potential uses | Speaker 4 |
| 2:45–3:00 | Close on Revitalize theme | Speaker 1 |
| 3:00–5:00 | Two-minute judge Q&A | Anyone, by expertise |

**Five-person coverage:** One primary host; one keyboard opponent; one hardware/game operator; one technical explainer; one person to manage table flow, backups, and Q&A. People can double up on speaking roles. Judges may return for multiple rounds; remain at the table.

### Final demo rehearsal checklist

- [ ] Product name and currently working game list confirmed by teammates.
- [ ] Browser loads the five-game lobby on the intended Mac.
- [ ] **Pong is explicitly switched to 2-player mode** before the judge-vs-teammate match.
- [ ] Confirm which AirPods head gesture moves Pong **with the current roll mapping**; do not assume pitch.
- [ ] Confirm native motion → transport → browser → Pong works with real AirPods; or use the clearly labeled fallback.
- [ ] Calibrate each participant quickly; check control direction and sensitivity.
- [ ] AirPods fit, hygiene, and opt-out plan are ready.
- [ ] Secondary game has been tested and loads quickly.
- [ ] Timed rehearsal stays under 3:00; have a 60-second shortened version ready.
- [ ] Everyone knows what was built, what was tested, and what remains incomplete.
- [ ] Keyboard fallback, charged hardware, and venue-independent local setup ready.
