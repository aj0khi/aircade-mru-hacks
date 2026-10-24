import CoreMotion
import Foundation

enum AirPodLabel: String, CaseIterable, Identifiable {
    case left = "Left"
    case right = "Right"

    var id: String { rawValue }
}

struct MotionSample: Identifiable, Hashable {
    let id: UUID
    let timestamp: Date
    let selectedAirPod: AirPodLabel
    let testDirection: String
    let testMode: String
    let pitchRadians: Double
    let rollRadians: Double
    let yawRadians: Double
    let gyroX: Double
    let gyroY: Double
    let gyroZ: Double
    let accelX: Double
    let accelY: Double
    let accelZ: Double
    let reportedSensorLocation: CMDeviceMotion.SensorLocation

    init(
        timestamp: Date = Date(),
        selectedAirPod: AirPodLabel,
        testDirection: String,
        testMode: String,
        motion: CMDeviceMotion
    ) {
        self.id = UUID()
        self.timestamp = timestamp
        self.selectedAirPod = selectedAirPod
        self.testDirection = testDirection
        self.testMode = testMode
        self.pitchRadians = motion.attitude.pitch
        self.rollRadians = motion.attitude.roll
        self.yawRadians = motion.attitude.yaw
        self.gyroX = motion.rotationRate.x
        self.gyroY = motion.rotationRate.y
        self.gyroZ = motion.rotationRate.z
        self.accelX = motion.userAcceleration.x
        self.accelY = motion.userAcceleration.y
        self.accelZ = motion.userAcceleration.z
        self.reportedSensorLocation = motion.sensorLocation
    }

    var pitchDegrees: Double { pitchRadians * Self.radiansToDegrees }
    var rollDegrees: Double { rollRadians * Self.radiansToDegrees }
    var yawDegrees: Double { yawRadians * Self.radiansToDegrees }

    var angularSpeed: Double {
        sqrt(gyroX * gyroX + gyroY * gyroY + gyroZ * gyroZ)
    }

    var accelerationMagnitude: Double {
        sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ)
    }

    static let radiansToDegrees = 180.0 / Double.pi
}

extension CMDeviceMotion.SensorLocation {
    var diagnosticName: String {
        switch self {
        case .default:
            return "default"
        case .headphoneLeft:
            return "headphoneLeft"
        case .headphoneRight:
            return "headphoneRight"
        @unknown default:
            return "unknown(\(rawValue))"
        }
    }
}
