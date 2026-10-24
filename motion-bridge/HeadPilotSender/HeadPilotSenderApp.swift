import SwiftUI

@main
struct HeadPilotSenderApp: App {
    @StateObject private var model = SenderModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .onAppear { model.start() }
                .onDisappear { model.stop() }
        }
        .windowResizability(.contentSize)
    }
}

struct ContentView: View {
    @EnvironmentObject private var model: SenderModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AIRCADE motion sender")
                .font(.title2.weight(.semibold))
            Text(model.status)
                .font(.body)
            if let error = model.lastError {
                Text(error)
                    .foregroundStyle(.red)
            }
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
                row("Browser clients", "\(model.clientCount)")
                row("Samples", "\(model.sampleCount)")
                axisRow("Yaw X", model.yaw, model.yawDegrees)
                axisRow("Pitch Y", model.pitch, model.pitchDegrees)
                axisRow("Roll", model.roll, model.rollDegrees)
                row("Accel Z", String(format: "%+.3f", model.accelZ))
            }
            .font(.body.monospaced())
            Button("Recenter") {
                model.recenter()
            }
            Text("Look straight ahead, then Recenter. Game values stay in −1…1; degrees can go past that. Pair AirPods, then in the arcade click Connect motion.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 460, alignment: .leading)
        }
        .padding(24)
        .frame(minWidth: 500, minHeight: 320)
    }

    private func row(_ title: String, _ value: String) -> some View {
        GridRow {
            Text(title)
            Text(value)
        }
    }

    private func axisRow(_ title: String, _ normalized: Double, _ degrees: Double) -> some View {
        GridRow {
            Text(title)
            Text(String(format: "%+.2f   %+.1f°", normalized, degrees))
        }
    }
}
