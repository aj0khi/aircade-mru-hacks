import Foundation

final class MotionRecorder {
    private(set) var samples: [MotionSample] = []
    private(set) var isRecording = false

    var sampleCount: Int { samples.count }

    func start() {
        samples.removeAll(keepingCapacity: true)
        isRecording = true
    }

    func stop() {
        isRecording = false
    }

    func append(_ sample: MotionSample) {
        guard isRecording else { return }
        samples.append(sample)
    }

    func csvString() -> String {
        let header = [
            "timestamp",
            "selected_airpod_label",
            "test_direction",
            "test_mode",
            "pitch_deg",
            "roll_deg",
            "yaw_deg",
            "gyro_x_rad_s",
            "gyro_y_rad_s",
            "gyro_z_rad_s",
            "accel_x_g",
            "accel_y_g",
            "accel_z_g",
            "angular_speed_rad_s",
            "acceleration_magnitude_g",
        ].joined(separator: ",")

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let rows = samples.map { sample in
            [
                iso.string(from: sample.timestamp),
                csvEscape(sample.selectedAirPod.rawValue),
                csvEscape(sample.testDirection),
                csvEscape(sample.testMode),
                format(sample.pitchDegrees),
                format(sample.rollDegrees),
                format(sample.yawDegrees),
                format(sample.gyroX),
                format(sample.gyroY),
                format(sample.gyroZ),
                format(sample.accelX),
                format(sample.accelY),
                format(sample.accelZ),
                format(sample.angularSpeed),
                format(sample.accelerationMagnitude),
            ].joined(separator: ",")
        }

        return ([header] + rows).joined(separator: "\n") + "\n"
    }

    func writeTemporaryCSV() throws -> URL {
        let name = "AirPodsMotion-\(Int(Date().timeIntervalSince1970)).csv"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try csvString().write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    private func format(_ value: Double) -> String {
        String(format: "%.6f", value)
    }

    private func csvEscape(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }
}
