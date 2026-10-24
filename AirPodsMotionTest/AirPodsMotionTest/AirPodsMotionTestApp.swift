import SwiftUI

@main
struct AirPodsMotionTestApp: App {
    @StateObject private var tracker = MotionTracker()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(tracker)
        }
    }
}
