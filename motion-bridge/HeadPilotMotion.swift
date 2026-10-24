import CoreMotion
import Foundation

/// The stable payload sent to HeadPilot Arcade.
struct HeadPilotMotionSample: Encodable {
    let type = "motion"
    let roll: Double
    let pitch: Double
    let swing: Double
    let timestamp: Int64

    init(roll: Double, pitch: Double, swing: Double, timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) {
        self.roll = roll
        self.pitch = pitch
        self.swing = swing
        self.timestamp = timestamp
    }
}

/// Converts Core Motion values into the normalized `-1...1` arcade contract.
struct HeadPilotMotionNormalizer {
    var angleSensitivity: Double = 1.2
    var swingSensitivity: Double = 2.0

    func sample(from deviceMotion: CMDeviceMotion) -> HeadPilotMotionSample {
        let roll = normalize(deviceMotion.attitude.roll, sensitivity: angleSensitivity)
        let pitch = normalize(deviceMotion.attitude.pitch, sensitivity: angleSensitivity)
        let swing = normalize(deviceMotion.userAcceleration.z, sensitivity: swingSensitivity)
        return HeadPilotMotionSample(roll: roll, pitch: pitch, swing: swing)
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

    func start() throws {
        guard manager.isDeviceMotionAvailable else {
            throw MotionSourceError.unavailable
        }
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
