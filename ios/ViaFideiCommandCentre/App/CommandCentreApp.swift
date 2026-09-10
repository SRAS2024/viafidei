import SwiftUI

/// Via Fidei — the iPhone companion to the macOS command centre.
///
/// Three surfaces, the same three the Mac app puts in its segmented control:
/// the Admin Worker command centre, the live public site, and the deployed
/// admin interface. The worker itself always runs on the Mac.
@main
struct CommandCentreApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
