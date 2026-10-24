import CoreMotion
import Foundation

/// Stores a Core Motion attitude snapshot and computes relative orientation
/// with `CMAttitude.multiply(byInverseOf:)`. Raw samples are never mutated.
final class MotionCalibration {
    private(set) var neutralAttitude: CMAttitude?
    private(set) var capturedAt: Date?
    private(set) var neutralPitchDegrees: Double?
    private(set) var neutralRollDegrees: Double?
    private(set) var neutralYawDegrees: Double?

    var hasNeutral: Bool { neutralAttitude != nil }

    func captureNeutral(from attitude: CMAttitude) {
        guard let copy = attitude.copy() as? CMAttitude else { return }
        neutralAttitude = copy
        capturedAt = Date()
        let degrees = MotionSample.radiansToDegrees
        neutralPitchDegrees = copy.pitch * degrees
        neutralRollDegrees = copy.roll * degrees
        neutralYawDegrees = copy.yaw * degrees
    }

    func relativeOrientation(from current: CMAttitude) -> (pitch: Double, roll: Double, yaw: Double)? {
        guard let neutral = neutralAttitude,
              let relative = current.copy() as? CMAttitude else {
            return nil
        }
        relative.multiply(byInverseOf: neutral)
        let degrees = MotionSample.radiansToDegrees
        return (
            pitch: relative.pitch * degrees,
            roll: relative.roll * degrees,
            yaw: relative.yaw * degrees
        )
    }

    func clear() {
        neutralAttitude = nil
        capturedAt = nil
        neutralPitchDegrees = nil
        neutralRollDegrees = nil
        neutralYawDegrees = nil
    }
}
