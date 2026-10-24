import Combine
@preconcurrency import CoreMotion
import Foundation

enum DirectionLabel: String, CaseIterable, Identifiable {
    case left = "Left"
    case right = "Right"
    case up = "Up"
    case down = "Down"

    var id: String { rawValue }
}

enum DirectionTestKind: String, CaseIterable, Identifiable {
    case rotation = "Rotation / tilt"
    case translation = "Translation"

    var id: String { rawValue }
}

enum MotionStatusMessage {
    static let noLiveData = "NO LIVE HEADPHONE MOTION DATA"
    static let sourceDisclaimer = "Motion source: Headphone motion — individual earbud not verified."
}

struct DirectionTestResult: Equatable {
    let direction: DirectionLabel
    let kind: DirectionTestKind
    let sampleCount: Int
    let durationSeconds: Double
    let baselinePitchDegrees: Double
    let baselineRollDegrees: Double
    let baselineYawDegrees: Double
    let deltaPitchDegrees: Double
    let deltaRollDegrees: Double
    let deltaYawDegrees: Double
    let peakGyroX: Double
    let peakGyroY: Double
    let peakGyroZ: Double
    let peakAccelX: Double
    let peakAccelY: Double
    let peakAccelZ: Double
    let peakAngularSpeed: Double
    let peakAccelerationMagnitude: Double
    let dominantAxis: String
    let dominantValue: Double
    let notes: String
}

enum HandheldPhase: Equatable {
    case idle
    case wearAndVerify
    case removeOne
    case holdSecurely
    case rotate
    case observe
}

struct HandheldObservation: Equatable {
    let phase: HandheldPhase
    let sampleCountAtEntry: Int
    let sampleCountNow: Int
    let samplesDuringPhase: Int
    let lastUpdateAge: TimeInterval?
    let liveUpdates: Bool
    let note: String
}

@MainActor
final class MotionTracker: NSObject, ObservableObject {
    static let staleInterval: TimeInterval = 2.0
    static let captureDuration: TimeInterval = 2.0

    let manager = CMHeadphoneMotionManager()
    let calibration = MotionCalibration()
    let recorder = MotionRecorder()

    private let motionQueue: OperationQueue = {
        let queue = OperationQueue()
        queue.name = "AirPodsMotionTest.HeadphoneMotion"
        queue.maxConcurrentOperationCount = 1
        queue.qualityOfService = .userInteractive
        return queue
    }()

    @Published var selectedAirPod: AirPodLabel = .left
    @Published var isTracking = false
    @Published var isRecording = false
    @Published var lastError: String?
    @Published var headphonesConnected: Bool?
    @Published var latestLiveSample: MotionSample?
    @Published var latestAttitude: CMAttitude?
    @Published var sampleCount = 0
    @Published var lastUpdate: Date?
    @Published var isStale = false
    @Published var countdownText: String?
    @Published var directionTestKind: DirectionTestKind = .rotation
    @Published var activeDirection: DirectionLabel?
    @Published var directionResult: DirectionTestResult?
    @Published var isDirectionTestRunning = false
    @Published var handheldPhase: HandheldPhase = .idle
    @Published var handheldObservations: [HandheldObservation] = []
    @Published var exportURL: URL?
    @Published var now = Date()

    private var freshnessCancellable: AnyCancellable?
    private var testTask: Task<Void, Never>?
    private var captureBaselineAttitude: CMAttitude?
    private var captureSamples: [MotionSample] = []
    private var captureKind: DirectionTestKind = .rotation
    private var captureDirection: DirectionLabel?
    private var captureStartedAt: Date?
    private var handheldEntryCounts: [HandheldPhase: Int] = [:]

    var isMotionAvailable: Bool { manager.isDeviceMotionAvailable }
    var authorizationDescription: String {
        switch CMHeadphoneMotionManager.authorizationStatus() {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorized: return "authorized"
        @unknown default: return "unknown"
        }
    }

    var lastUpdateAge: TimeInterval? {
        guard let lastUpdate else { return nil }
        return now.timeIntervalSince(lastUpdate)
    }

    var currentTestMode: String {
        if handheldPhase != .idle { return "Handheld \(handheldPhaseLabel)" }
        if let activeDirection {
            return "\(directionTestKind.rawValue) \(activeDirection.rawValue)"
        }
        return "Live"
    }

    var currentTestDirection: String {
        activeDirection?.rawValue ?? "None"
    }

    var handheldPhaseLabel: String {
        switch handheldPhase {
        case .idle: return "Idle"
        case .wearAndVerify: return "Wear and verify"
        case .removeOne: return "Remove one AirPod"
        case .holdSecurely: return "Hold securely"
        case .rotate: return "Rotate in hand"
        case .observe: return "Observe freshness"
        }
    }

    override init() {
        super.init()
        manager.delegate = self
        manager.startConnectionStatusUpdates()
        freshnessCancellable = Timer.publish(every: 0.2, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.tickFreshness()
            }
    }

    func startTracking() {
        lastError = nil
        guard !isTracking else { return }
        guard manager.isDeviceMotionAvailable else {
            lastError = "Headphone motion is unavailable. Connect compatible AirPods and try again."
            latestLiveSample = nil
            return
        }

        isTracking = true
        manager.startDeviceMotionUpdates(to: motionQueue) { [weak self] motion, error in
            Task { @MainActor in
                self?.handleMotion(motion, error: error)
            }
        }
    }

    func stopTracking() {
        testTask?.cancel()
        testTask = nil
        isTracking = false
        isDirectionTestRunning = false
        countdownText = nil
        captureSamples.removeAll()
        captureBaselineAttitude = nil
        captureDirection = nil
        captureStartedAt = nil
        activeDirection = nil
        manager.stopDeviceMotionUpdates()
        latestLiveSample = nil
        latestAttitude = nil
        isStale = false
        if isRecording {
            stopRecording()
        }
    }

    func calibrateNeutral() {
        guard let attitude = latestAttitude, latestLiveSample != nil, !isStale else {
            lastError = "Cannot calibrate: no live headphone motion sample."
            return
        }
        calibration.captureNeutral(from: attitude)
    }

    func startRecording() {
        recorder.start()
        isRecording = true
    }

    func stopRecording() {
        recorder.stop()
        isRecording = false
    }

    func exportCSV() {
        do {
            exportURL = try recorder.writeTemporaryCSV()
        } catch {
            lastError = "CSV export failed: \(error.localizedDescription)"
        }
    }

    func startDirectionTest(_ direction: DirectionLabel) {
        guard latestLiveSample != nil, !isStale, let attitude = latestAttitude else {
            lastError = "Start tracking and wait for live samples before running a direction test."
            return
        }
        testTask?.cancel()
        isDirectionTestRunning = true
        activeDirection = direction
        directionResult = nil
        captureKind = directionTestKind
        captureDirection = direction
        captureBaselineAttitude = attitude.copy() as? CMAttitude
        captureSamples.removeAll()
        captureStartedAt = nil

        testTask = Task { [weak self] in
            guard let self else { return }
            for value in [3, 2, 1] {
                if Task.isCancelled { return }
                await MainActor.run { self.countdownText = "Hold still, then move \(direction.rawValue.lowercased()) in \(value)…" }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
            if Task.isCancelled { return }
            await MainActor.run {
                self.countdownText = "Capturing \(Int(Self.captureDuration))s — \(self.captureKind.rawValue)"
                self.captureStartedAt = Date()
                self.captureSamples.removeAll()
            }
            try? await Task.sleep(nanoseconds: UInt64(Self.captureDuration * 1_000_000_000))
            if Task.isCancelled { return }
            await MainActor.run {
                self.finishDirectionTest()
            }
        }
    }

    func beginHandheldTest() {
        handheldObservations.removeAll()
        handheldEntryCounts.removeAll()
        enterHandheldPhase(.wearAndVerify)
    }

    func advanceHandheldTest() {
        switch handheldPhase {
        case .idle:
            beginHandheldTest()
        case .wearAndVerify:
            enterHandheldPhase(.removeOne)
        case .removeOne:
            enterHandheldPhase(.holdSecurely)
        case .holdSecurely:
            enterHandheldPhase(.rotate)
        case .rotate:
            enterHandheldPhase(.observe)
        case .observe:
            recordHandheldObservation()
            handheldPhase = .idle
        }
    }

    func cancelHandheldTest() {
        if handheldPhase != .idle {
            recordHandheldObservation()
        }
        handheldPhase = .idle
    }

    private func enterHandheldPhase(_ phase: HandheldPhase) {
        if handheldPhase != .idle {
            recordHandheldObservation()
        }
        handheldPhase = phase
        handheldEntryCounts[phase] = sampleCount
    }

    private func recordHandheldObservation() {
        let phase = handheldPhase
        let entry = handheldEntryCounts[phase] ?? sampleCount
        let age = lastUpdateAge
        let live = latestLiveSample != nil && !isStale
        let samplesDuring = max(0, sampleCount - entry)
        let note: String
        if !isTracking {
            note = "Tracking is stopped. No conclusion about handheld motion."
        } else if !live {
            note = MotionStatusMessage.noLiveData
        } else {
            note = "Live samples arrived during this step (\(samplesDuring) new). That is an observation, not proof that handheld tracking is supported."
        }
        handheldObservations.append(
            HandheldObservation(
                phase: phase,
                sampleCountAtEntry: entry,
                sampleCountNow: sampleCount,
                samplesDuringPhase: samplesDuring,
                lastUpdateAge: age,
                liveUpdates: live,
                note: note
            )
        )
    }

    private func handleMotion(_ motion: CMDeviceMotion?, error: Error?) {
        if let error {
            lastError = error.localizedDescription
            return
        }
        guard let motion else { return }

        let sample = MotionSample(
            selectedAirPod: selectedAirPod,
            testDirection: currentTestDirection,
            testMode: currentTestMode,
            motion: motion
        )
        latestAttitude = motion.attitude.copy() as? CMAttitude
        latestLiveSample = sample
        lastUpdate = sample.timestamp
        sampleCount += 1
        isStale = false
        recorder.append(sample)

        if let captureStartedAt, Date().timeIntervalSince(captureStartedAt) <= Self.captureDuration + 0.05 {
            captureSamples.append(sample)
        }
    }

    private func tickFreshness() {
        now = Date()
        guard isTracking else {
            isStale = false
            return
        }
        if let lastUpdate, now.timeIntervalSince(lastUpdate) >= Self.staleInterval {
            isStale = true
            latestLiveSample = nil
        }
    }

    private func finishDirectionTest() {
        countdownText = nil
        isDirectionTestRunning = false
        defer {
            captureSamples.removeAll()
            captureBaselineAttitude = nil
            captureStartedAt = nil
            activeDirection = nil
        }

        guard let direction = captureDirection else { return }
        let samples = captureSamples
        let kind = captureKind

        var deltaPitch = 0.0
        var deltaRoll = 0.0
        var deltaYaw = 0.0
        if let baseline = captureBaselineAttitude, let lastAttitude = latestAttitude {
            let relative = lastAttitude.copy() as? CMAttitude
            relative?.multiply(byInverseOf: baseline)
            if let relative {
                let degrees = MotionSample.radiansToDegrees
                deltaPitch = relative.pitch * degrees
                deltaRoll = relative.roll * degrees
                deltaYaw = relative.yaw * degrees
            }
        }

        let peakGyroX = samples.map { abs($0.gyroX) }.max() ?? 0
        let peakGyroY = samples.map { abs($0.gyroY) }.max() ?? 0
        let peakGyroZ = samples.map { abs($0.gyroZ) }.max() ?? 0
        let peakAccelX = samples.map { abs($0.accelX) }.max() ?? 0
        let peakAccelY = samples.map { abs($0.accelY) }.max() ?? 0
        let peakAccelZ = samples.map { abs($0.accelZ) }.max() ?? 0
        let peakAngular = samples.map(\.angularSpeed).max() ?? 0
        let peakAccelMag = samples.map(\.accelerationMagnitude).max() ?? 0

        let gyroPeaks: [(String, Double)] = [("rotationRate.x", peakGyroX), ("rotationRate.y", peakGyroY), ("rotationRate.z", peakGyroZ)]
        let accelPeaks: [(String, Double)] = [("userAcceleration.x", peakAccelX), ("userAcceleration.y", peakAccelY), ("userAcceleration.z", peakAccelZ)]
        let candidates = kind == .rotation ? gyroPeaks : accelPeaks
        let dominant = candidates.max(by: { $0.1 < $1.1 }) ?? ("none", 0)

        let signedGyro: [(String, Double)] = [
            ("rotationRate.x", samples.last?.gyroX ?? 0),
            ("rotationRate.y", samples.last?.gyroY ?? 0),
            ("rotationRate.z", samples.last?.gyroZ ?? 0),
        ]
        _ = signedGyro

        let notes: String
        if samples.isEmpty {
            notes = "No samples were captured. Core Motion did not deliver headphone motion during the window."
        } else {
            notes = "Dominant axis is the largest peak magnitude in this capture. Signs are Core Motion values as received; they are not mapped to left/right/up/down."
        }

        let baselinePitch = (captureBaselineAttitude?.pitch ?? 0) * MotionSample.radiansToDegrees
        let baselineRoll = (captureBaselineAttitude?.roll ?? 0) * MotionSample.radiansToDegrees
        let baselineYaw = (captureBaselineAttitude?.yaw ?? 0) * MotionSample.radiansToDegrees

        directionResult = DirectionTestResult(
            direction: direction,
            kind: kind,
            sampleCount: samples.count,
            durationSeconds: Self.captureDuration,
            baselinePitchDegrees: baselinePitch,
            baselineRollDegrees: baselineRoll,
            baselineYawDegrees: baselineYaw,
            deltaPitchDegrees: deltaPitch,
            deltaRollDegrees: deltaRoll,
            deltaYawDegrees: deltaYaw,
            peakGyroX: peakGyroX,
            peakGyroY: peakGyroY,
            peakGyroZ: peakGyroZ,
            peakAccelX: peakAccelX,
            peakAccelY: peakAccelY,
            peakAccelZ: peakAccelZ,
            peakAngularSpeed: peakAngular,
            peakAccelerationMagnitude: peakAccelMag,
            dominantAxis: dominant.0,
            dominantValue: dominant.1,
            notes: notes
        )
    }
}

extension MotionTracker: CMHeadphoneMotionManagerDelegate {
    nonisolated func headphoneMotionManagerDidConnect(_ manager: CMHeadphoneMotionManager) {
        Task { @MainActor in
            self.headphonesConnected = true
        }
    }

    nonisolated func headphoneMotionManagerDidDisconnect(_ manager: CMHeadphoneMotionManager) {
        Task { @MainActor in
            self.headphonesConnected = false
        }
    }
}
