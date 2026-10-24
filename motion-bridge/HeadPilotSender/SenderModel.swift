import Foundation

@MainActor
final class SenderModel: ObservableObject {
    @Published var status = "Starting…"
    @Published var sampleCount = 0
    @Published var clientCount = 0
    @Published var yaw = 0.0
    @Published var pitch = 0.0
    @Published var roll = 0.0
    @Published var accelZ = 0.0
    @Published var yawDegrees = 0.0
    @Published var pitchDegrees = 0.0
    @Published var rollDegrees = 0.0
    @Published var lastError: String?

    private let relay = WebSocketRelay()
    private var source: HeadPilotMotionSource?

    func start() {
        lastError = nil
        relay.onClientCount = { [weak self] count in
            self?.clientCount = count
        }
        do {
            try relay.start(port: 8787)
        } catch {
            lastError = error.localizedDescription
            status = "WebSocket failed"
            return
        }

        let source = HeadPilotMotionSource { [weak self] sample in
            Task { @MainActor in
                self?.handle(sample)
            }
        }
        self.source = source
        do {
            try source.start()
            status = "AirPods motion live on ws://127.0.0.1:8787"
        } catch {
            lastError = error.localizedDescription
            status = "Motion unavailable — pair AirPods to this Mac"
        }
    }

    func recenter() {
        source?.resetOrigin()
        yaw = 0
        pitch = 0
        roll = 0
        yawDegrees = 0
        pitchDegrees = 0
        rollDegrees = 0
    }

    func stop() {
        source?.stop()
        relay.stop()
        status = "Stopped"
    }

    private func handle(_ sample: HeadPilotMotionSample) {
        sampleCount += 1
        yaw = sample.yaw
        pitch = sample.pitch
        roll = sample.roll
        accelZ = sample.accelZ
        yawDegrees = sample.yawDegrees
        pitchDegrees = sample.pitchDegrees
        rollDegrees = sample.rollDegrees
        if let data = try? encodeForHeadPilot(sample) {
            relay.broadcast(data)
        }
    }
}
