import CoreMotion
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var tracker: MotionTracker
    @State private var showingShare = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    conventionTable
                    airPodSelector
                    statusCard
                    if tracker.isStale || (tracker.isTracking && tracker.latestLiveSample == nil) {
                        staleBanner
                    }
                    orientationCard
                    gyroscopeCard
                    accelerometerCard
                    controlsCard
                    directionTestCard
                    handheldCard
                    if let result = tracker.directionResult {
                        directionResultCard(result)
                    }
                    if !tracker.handheldObservations.isEmpty {
                        handheldResultsCard
                    }
                }
                .padding()
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("AirPods Motion Test")
            .sheet(isPresented: $showingShare) {
                if let url = tracker.exportURL {
                    ShareSheet(items: [url])
                }
            }
        }
    }

    private var conventionTable: some View {
        card("Coordinate convention") {
            Text("Axis signs are shown exactly as Core Motion reports them. Do not assume LEFT is negative X or UP is positive Y.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                gridHeader("Physical action", "Definition")
                gridRow("LEFT", "Move or tilt the AirPod toward the tester's left")
                gridRow("RIGHT", "Move or tilt the AirPod toward the tester's right")
                gridRow("UP", "Move or tilt the AirPod upward")
                gridRow("DOWN", "Move or tilt the AirPod downward")
                gridRow("NEUTRAL", "Hold the AirPod stationary in its initial position")
            }
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                gridHeader("Quantity", "Meaning")
                gridRow("Orientation", "Pitch, roll, yaw from attitude. Where it is pointing.")
                gridRow("Rotation / tilt", "Change in orientation. Not a position in space.")
                gridRow("Angular velocity", "Gyroscope rotationRate in rad/s. How fast it is spinning.")
                gridRow("Translation", "Linear movement through space. Not recovered as XYZ position.")
                gridRow("Linear acceleration", "userAcceleration in g, gravity removed. Instant push, not location.")
            }
        }
    }

    private var airPodSelector: some View {
        card("AirPod under test") {
            Picker("AirPod under test", selection: $tracker.selectedAirPod) {
                ForEach(AirPodLabel.allCases) { label in
                    Text(label.rawValue).tag(label)
                }
            }
            .pickerStyle(.segmented)
            Text("Experimental label only: which physical AirPod you intend to move.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text(MotionStatusMessage.sourceDisclaimer)
                .font(.subheadline.weight(.semibold))
            if let sample = tracker.latestLiveSample {
                labeled("Core Motion sensorLocation (API-reported, not taken from the selector)", sample.reportedSensorLocation.diagnosticName)
            }
        }
    }

    private var statusCard: some View {
        card("Connection status") {
            labeled("Headphone motion available", tracker.isMotionAvailable ? "available" : "unavailable")
            labeled("Tracking", tracker.isTracking ? "active" : "inactive")
            labeled("Headphones connected callback", tracker.headphonesConnected.map { $0 ? "didConnect" : "didDisconnect" } ?? "no event yet")
            labeled("Authorization", tracker.authorizationDescription)
            labeled("Last update", tracker.lastUpdate.map { $0.formatted(date: .omitted, time: .standard) } ?? "none")
            labeled("Update age", tracker.lastUpdateAge.map { String(format: "%.2f s", $0) } ?? "n/a")
            labeled("Sample count", "\(tracker.sampleCount)")
            labeled("Recording", tracker.isRecording ? "yes (\(tracker.recorder.sampleCount) samples)" : "no")
            if let error = tracker.lastError {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.footnote)
            }
            if !tracker.isMotionAvailable {
                Text("If AirPods do not provide motion data, this app reports unavailable or waits. It does not invent values.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var staleBanner: some View {
        Text(MotionStatusMessage.noLiveData)
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.red.opacity(0.15))
            .foregroundStyle(.red)
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var orientationCard: some View {
        card("Orientation (degrees)") {
            if let sample = tracker.latestLiveSample {
                valueRow("Pitch  attitude.pitch", sample.pitchDegrees, "°")
                valueRow("Roll   attitude.roll", sample.rollDegrees, "°")
                valueRow("Yaw    attitude.yaw", sample.yawDegrees, "°")
            } else {
                Text("No current orientation. Stale readings are not shown as live.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if tracker.calibration.hasNeutral {
                labeled("Neutral pitch", format(tracker.calibration.neutralPitchDegrees, unit: "°"))
                labeled("Neutral roll", format(tracker.calibration.neutralRollDegrees, unit: "°"))
                labeled("Neutral yaw", format(tracker.calibration.neutralYawDegrees, unit: "°"))
                if let attitude = tracker.latestAttitude,
                   tracker.latestLiveSample != nil,
                   let relative = tracker.calibration.relativeOrientation(from: attitude) {
                    valueRow("Relative pitch", relative.pitch, "°")
                    valueRow("Relative roll", relative.roll, "°")
                    valueRow("Relative yaw", relative.yaw, "°")
                }
            } else {
                Text("No neutral calibration yet. Raw values above are unmodified.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var gyroscopeCard: some View {
        card("Gyroscope (rad/s)") {
            if let sample = tracker.latestLiveSample {
                valueRow("Gyro X  rotationRate.x", sample.gyroX, "rad/s")
                valueRow("Gyro Y  rotationRate.y", sample.gyroY, "rad/s")
                valueRow("Gyro Z  rotationRate.z", sample.gyroZ, "rad/s")
                valueRow("Angular speed", sample.angularSpeed, "rad/s")
                Text("Angular speed is √(x²+y²+z²). It is not linear swing speed.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Text("No current gyroscope data.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var accelerometerCard: some View {
        card("Accelerometer (g)") {
            if let sample = tracker.latestLiveSample {
                valueRow("Accel X  userAcceleration.x", sample.accelX, "g")
                valueRow("Accel Y  userAcceleration.y", sample.accelY, "g")
                valueRow("Accel Z  userAcceleration.z", sample.accelZ, "g")
                valueRow("Acceleration magnitude", sample.accelerationMagnitude, "g")
                Text("These are linear acceleration samples, not an XYZ position.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Text("No current accelerometer data.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var controlsCard: some View {
        card("Controls") {
            HStack {
                button("Start Tracking", enabled: !tracker.isTracking, kind: .primary) {
                    tracker.startTracking()
                }
                button("Stop Tracking", enabled: tracker.isTracking, kind: .destructive) {
                    tracker.stopTracking()
                }
            }
            HStack {
                button("Calibrate Neutral", enabled: tracker.latestLiveSample != nil) {
                    tracker.calibrateNeutral()
                }
                button("Clear Neutral", enabled: tracker.calibration.hasNeutral) {
                    tracker.calibration.clear()
                }
            }
            HStack {
                button("Start Recording", enabled: !tracker.isRecording) {
                    tracker.startRecording()
                }
                button("Stop Recording", enabled: tracker.isRecording) {
                    tracker.stopRecording()
                }
            }
            button("Export CSV", enabled: tracker.recorder.sampleCount > 0, kind: .primary) {
                tracker.exportCSV()
                showingShare = tracker.exportURL != nil
            }
            Text("CSV contains only samples actually received from Core Motion.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var directionTestCard: some View {
        card("Direction testing") {
            Picker("Test kind", selection: $tracker.directionTestKind) {
                ForEach(DirectionTestKind.allCases) { kind in
                    Text(kind.rawValue).tag(kind)
                }
            }
            .pickerStyle(.segmented)
            Text(tracker.directionTestKind == .rotation
                 ? "Rotation / tilt: watch orientation deltas and peak gyroscope axes."
                 : "Translation: watch peak userAcceleration axes. This is not position.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let countdown = tracker.countdownText {
                Text(countdown)
                    .font(.headline)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(DirectionLabel.allCases) { direction in
                    button("Test \(direction.rawValue)", enabled: tracker.isTracking && !tracker.isDirectionTestRunning) {
                        tracker.startDirectionTest(direction)
                    }
                }
            }
        }
    }

    private func directionResultCard(_ result: DirectionTestResult) -> some View {
        card("Direction result") {
            labeled("Label", "\(result.kind.rawValue) / \(result.direction.rawValue)")
            labeled("Samples captured", "\(result.sampleCount) in \(String(format: "%.1f", result.durationSeconds)) s")
            valueRow("Δ pitch", result.deltaPitchDegrees, "°")
            valueRow("Δ roll", result.deltaRollDegrees, "°")
            valueRow("Δ yaw", result.deltaYawDegrees, "°")
            valueRow("Peak |gyro X|", result.peakGyroX, "rad/s")
            valueRow("Peak |gyro Y|", result.peakGyroY, "rad/s")
            valueRow("Peak |gyro Z|", result.peakGyroZ, "rad/s")
            valueRow("Peak |accel X|", result.peakAccelX, "g")
            valueRow("Peak |accel Y|", result.peakAccelY, "g")
            valueRow("Peak |accel Z|", result.peakAccelZ, "g")
            labeled("Dominant responding axis", "\(result.dominantAxis) = \(String(format: "%.3f", result.dominantValue))")
            Text(result.notes)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var handheldCard: some View {
        card("Handheld AirPod feasibility") {
            Text("Wear the AirPods, confirm live updates, then remove one and hold it. This test reports what arrived. It does not claim handheld tracking works.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            labeled("Current step", tracker.handheldPhaseLabel)
            HStack {
                button(tracker.handheldPhase == .idle ? "Start Handheld Test" : "Next Step", enabled: true, kind: .primary) {
                    tracker.advanceHandheldTest()
                }
                button("End Handheld Test", enabled: tracker.handheldPhase != .idle) {
                    tracker.cancelHandheldTest()
                }
            }
            stepList
        }
    }

    private var stepList: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("1. Start tracking while wearing the AirPods.")
            Text("2. Verify that motion updates arrive.")
            Text("3. Remove one AirPod.")
            Text("4. Hold the AirPod securely.")
            Text("5. Rotate it.")
            Text("6. Observe whether updates continue.")
        }
        .font(.footnote)
    }

    private var handheldResultsCard: some View {
        card("Handheld observations") {
            ForEach(Array(tracker.handheldObservations.enumerated()), id: \.offset) { _, observation in
                VStack(alignment: .leading, spacing: 4) {
                    Text(phaseName(observation.phase))
                        .font(.subheadline.weight(.semibold))
                    labeled("Samples in step", "\(observation.samplesDuringPhase) (from \(observation.sampleCountAtEntry) to \(observation.sampleCountNow))")
                    labeled("Live updates", observation.liveUpdates ? "yes" : "no")
                    if let age = observation.lastUpdateAge {
                        labeled("Last update age", String(format: "%.2f s", age))
                    }
                    Text(observation.note)
                        .font(.footnote)
                        .foregroundStyle(observation.liveUpdates ? Color.secondary : Color.red)
                }
                Divider()
            }
        }
    }

    private func phaseName(_ phase: HandheldPhase) -> String {
        switch phase {
        case .idle: return "Idle"
        case .wearAndVerify: return "Wear and verify"
        case .removeOne: return "Remove one"
        case .holdSecurely: return "Hold securely"
        case .rotate: return "Rotate"
        case .observe: return "Observe"
        }
    }

    private func card(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            content()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body.monospaced())
        }
    }

    private func valueRow(_ title: String, _ value: Double, _ unit: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text("\(signed(value)) \(unit)")
                .font(.body.monospaced())
        }
    }

    private func gridHeader(_ left: String, _ right: String) -> some View {
        GridRow {
            Text(left).font(.caption.weight(.semibold))
            Text(right).font(.caption.weight(.semibold))
        }
    }

    private func gridRow(_ left: String, _ right: String) -> some View {
        GridRow {
            Text(left).font(.caption.monospaced())
            Text(right).font(.caption)
        }
    }

    private enum ButtonKind {
        case normal, primary, destructive
    }

    private func button(_ title: String, enabled: Bool, kind: ButtonKind = .normal, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .buttonStyle(.borderedProminent)
            .tint(kind == .destructive ? .red : kind == .primary ? .blue : .gray)
            .disabled(!enabled)
            .frame(maxWidth: .infinity)
    }

    private func signed(_ value: Double) -> String {
        String(format: "%+.3f", value)
    }

    private func format(_ value: Double?, unit: String) -> String {
        guard let value else { return "n/a" }
        return "\(signed(value)) \(unit)"
    }
}
