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
  "roll": -0.35,
  "pitch": 0.12,
  "swing": 0.04,
  "timestamp": 1792800000000
}
```

All motion values are normalized to `-1...1`:

- `roll`: left/right wrist rotation; Pong paddle and Bowling aim.
- `pitch`: up/down wrist rotation; Snake vertical direction.
- `swing`: forward acceleration pulse; Bowling throw.
- `timestamp`: Unix time in milliseconds.

The browser listens by default at `ws://127.0.0.1:8787`. Connect it with:

```js
window.gyroArcade.connectMotionBridge("ws://127.0.0.1:8787");
```

The bridge can also be tested without AirPods:

```js
window.gyroArcade.setMotionSample({ roll: 0.5, pitch: 0, swing: 0 });
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
