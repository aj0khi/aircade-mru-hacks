import CoreMotion
import Foundation

/// Named AirPods axes plus the old `{roll,pitch,swing}` aliases.
/// `yaw`/`pitch`/`roll` are game values in `-1...1`. Degrees are for the sender UI.
struct HeadPilotMotionSample: Encodable {
    let type = "motion"
    let yaw: Double
    let pitch: Double
    let roll: Double
    let accelX: Double
    let accelY: Double
    let accelZ: Double
    let swing: Double
    let timestamp: Int64
    let yawDegrees: Double
    let pitchDegrees: Double
    let rollDegrees: Double

    enum CodingKeys: String, CodingKey {
        case type, yaw, pitch, roll, accelX, accelY, accelZ, swing, timestamp
    }

    init(
        yaw: Double,
        pitch: Double,
        roll: Double,
        accelX: Double,
        accelY: Double,
        accelZ: Double,
        yawDegrees: Double,
        pitchDegrees: Double,
        rollDegrees: Double,
        timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000)
    ) {
        self.yaw = yaw
        self.pitch = pitch
        self.roll = roll
        self.accelX = accelX
        self.accelY = accelY
        self.accelZ = accelZ
        self.swing = accelZ
        self.timestamp = timestamp
        self.yawDegrees = yawDegrees
        self.pitchDegrees = pitchDegrees
        self.rollDegrees = rollDegrees
    }
}

/// Games pick one axis and ignore the rest.
/// X = yaw, Y = pitch, bowling throw = accel Z.
///
/// Zero is a relative CMAttitude (look straight ahead), not world Euler 0.
/// AirPods rest pitch is often already large, so subtracting 0 makes +1 at rest
/// and you have to nod a long way before negatives appear.
final class HeadPilotMotionNormalizer {
    /// About 20° of look/nod is full scale for the games.
    var angleSensitivity: Double = 0.35
    var accelSensitivity: Double = 0.16
    private let lock = NSLock()
    private var origin: CMAttitude?
    private var samplesUntilOrigin = 25

    func resetOrigin() {
        lock.lock()
        origin = nil
        samplesUntilOrigin = 8
        lock.unlock()
    }

    func sample(from deviceMotion: CMDeviceMotion) -> HeadPilotMotionSample {
        lock.lock()
        defer { lock.unlock() }

        if origin == nil {
            if samplesUntilOrigin > 0 {
                samplesUntilOrigin -= 1
            }
            if samplesUntilOrigin == 0 {
                origin = deviceMotion.attitude.copy() as? CMAttitude
            }
        }

        var yaw = 0.0
        var pitch = 0.0
        var roll = 0.0
        if let origin, let relative = deviceMotion.attitude.copy() as? CMAttitude {
            relative.multiply(byInverseOf: origin)
            // AirPods yaw/pitch are opposite the arcade (look right was left, look up was down).
            yaw = -relative.yaw
            pitch = -relative.pitch
            roll = relative.roll
        }

        let accel = deviceMotion.userAcceleration
        let degrees = 180.0 / Double.pi
        return HeadPilotMotionSample(
            yaw: normalize(yaw, sensitivity: angleSensitivity),
            pitch: normalize(pitch, sensitivity: angleSensitivity),
            roll: normalize(roll, sensitivity: angleSensitivity),
            accelX: normalize(accel.x, sensitivity: accelSensitivity),
            accelY: normalize(accel.y, sensitivity: accelSensitivity),
            accelZ: normalize(accel.z, sensitivity: accelSensitivity),
            yawDegrees: yaw * degrees,
            pitchDegrees: pitch * degrees,
            rollDegrees: roll * degrees
        )
    }

    private func normalize(_ value: Double, sensitivity: Double) -> Double {
        max(-1, min(1, value / sensitivity))
    }
}

/// Reads AirPods motion and invokes a callback at the requested update rate.
final class HeadPilotMotionSource {
    private let manager = CMHeadphoneMotionManager()
    private let queue = OperationQueue()
    private let normalizer: HeadPilotMotionNormalizer
    private let onSample: (HeadPilotMotionSample) -> Void

    init(
        normalizer: HeadPilotMotionNormalizer = HeadPilotMotionNormalizer(),
        onSample: @escaping (HeadPilotMotionSample) -> Void
    ) {
        self.normalizer = normalizer
        self.onSample = onSample
        queue.qualityOfService = .userInteractive
    }

    var isAvailable: Bool { manager.isDeviceMotionAvailable }

    func resetOrigin() {
        normalizer.resetOrigin()
    }

    func start() throws {
        guard isAvailable else {
            throw MotionSourceError.unavailable
        }
        normalizer.resetOrigin()
        manager.startDeviceMotionUpdates(to: queue) { [normalizer, onSample] motion, error in
            guard error == nil, let motion else { return }
            onSample(normalizer.sample(from: motion))
        }
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
    }
}

enum MotionSourceError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        "AirPods head motion is unavailable. Connect compatible AirPods and enable motion access."
    }
}

/// Example encoder for a WebSocket or local transport implementation.
func encodeForHeadPilot(_ sample: HeadPilotMotionSample) throws -> Data {
    try JSONEncoder().encode(sample)
}
