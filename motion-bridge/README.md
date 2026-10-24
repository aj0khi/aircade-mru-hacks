# HeadPilot macOS motion bridge

This folder contains the small Swift adapter needed to turn AirPods motion into
the browser's stable motion contract. It is intentionally transport-agnostic:
the `HeadPilotMotionSource` callback gives your macOS app a JSON-ready sample
that can be sent over WebSocket, TCP, or another local transport.

## Payload contract

Send one JSON object per sample:

```json
{
  "type": "motion",
  "yaw": -0.35,
  "pitch": 0.12,
  "roll": 0.02,
  "accelX": 0.0,
  "accelY": 0.0,
  "accelZ": -0.55,
  "swing": -0.55,
  "timestamp": 1792800000000
}
```

Values are normalized to `-1...1`. Each game uses only the axes it needs:

- **X / yaw:** look left and right. Breakout, Snake left/right, bowling aim.
- **Y / pitch:** nod. Pong paddle, Snake up/down.
- **Z / accelZ:** forward bowl swing. Bowling throw only.
- Ear-to-shoulder `roll`, accel X/Y, and gyro are sent for logging and ignored by the cabinets.

## Run the Mac sender

Pair AirPods to the **Mac**, then start the sender and the arcade:

```bash
open motion-bridge/DerivedData/Build/Products/Release/HeadPilotSender.app
npm run dev
```

Allow Motion if macOS asks. The sender window should show samples increasing once AirPods are in-ear. In the arcade, click **Connect motion**.

To rebuild from Xcode:

```bash
open motion-bridge/HeadPilotSender.xcodeproj
```

The browser listens by default at `ws://127.0.0.1:8787`. Connect it with:

```js
window.gyroArcade.connectMotionBridge("ws://127.0.0.1:8787");
```

The bridge can also be tested without AirPods:

```js
window.gyroArcade.setMotionSample({ yaw: 0.5, pitch: 0, accelZ: 0 });
```

## Swift usage

```swift
let source = HeadPilotMotionSource { sample in
    let data = try? encodeForHeadPilot(sample)
    // Send `data` through your local WebSocket transport.
}

try source.start()
```

`CMHeadphoneMotionManager` is macOS-only and requires compatible AirPods,
motion permission, and an app transport that connects to the browser's
WebSocket endpoint. Stop the source when the app exits:

```swift
source.stop()
```
