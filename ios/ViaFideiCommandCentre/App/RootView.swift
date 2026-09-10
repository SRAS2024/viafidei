import SwiftUI

/// THE THREE VIEWS, ON A PHONE.
///
/// The Mac app switches between "Admin Worker", "Standard Site" and
/// "Admin Site" with an `NSSegmentedControl`. On iPhone that becomes a
/// `TabView`, for three reasons a segmented picker under a title cannot
/// match:
///
///  • Each tab keeps its own state alive. The two web tabs stay loaded and
///    signed in; the command centre keeps its scroll position and its folded
///    sections. A segmented picker inside one screen would tear the web view
///    down and rebuild it on every switch.
///  • The command centre is a tall, data-dense scroll with a large navigation
///    title. A picker pinned under that title would eat a permanent strip of
///    the most valuable vertical space on the screen — the exact "desktop
///    layout squeezed onto glass" the brief rules out.
///  • The tab bar sits in the thumb's reach at the bottom and stays out of
///    the way of the page content above it.
@MainActor
struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase

    @StateObject private var network = NetworkMonitor.shared
    @StateObject private var worker: WorkerStore
    @StateObject private var auth = AuthController()

    @State private var selection: Tab = .worker
    @State private var showingAuth = false

    private enum Tab: Hashable {
        case worker, standard, admin
    }

    init() {
        _worker = StateObject(wrappedValue: WorkerStore())
    }

    var body: some View {
        sessionAware
            .onChange(of: selection) { _, tab in
                worker.isFrontmost = (tab == .worker)
            }
            .onChange(of: scenePhase) { _, phase in
                handleScenePhase(phase)
            }
    }

    /// Sign-in state: start the poll, and raise the cover on a 401.
    private var sessionAware: some View {
        shell
            .task { await start() }
            .onChange(of: worker.phase) { _, phase in
                showingAuth = (phase == WorkerStore.Phase.signedOut)
            }
    }

    /// The three surfaces, plus the sign-in cover that sits over all of them.
    private var shell: some View {
        tabs
            .tint(Color.accentColor)
            .fullScreenCover(isPresented: $showingAuth) {
                AuthView(controller: auth, network: network)
                    .interactiveDismissDisabled()
            }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            workerTab
            standardSiteTab
            adminSiteTab
        }
    }

    private var workerTab: some View {
        NavigationStack { WorkerView(store: worker) }
            .tabItem {
                Label("Worker", systemImage: "gauge.with.dots.needle.bottom.50percent")
            }
            .tag(Tab.worker)
    }

    private var standardSiteTab: some View {
        NavigationStack {
            SiteTab(home: Endpoints.standardSite, title: "Live Site", network: network)
        }
        .tabItem { Label("Live Site", systemImage: "globe") }
        .tag(Tab.standard)
    }

    private var adminSiteTab: some View {
        NavigationStack {
            SiteTab(home: Endpoints.adminSite, title: "Admin Site", network: network)
        }
        .tabItem { Label("Admin Site", systemImage: "lock.shield") }
        .tag(Tab.admin)
    }

    private func start() async {
        auth.onSignedIn = {
            showingAuth = false
            worker.signedInAgain()
        }
        if scenePhase == .active { worker.resume() }
    }

    private func handleScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .active:
            // Immediately on returning to the foreground, so a change made at
            // the Mac is on screen within a second of looking.
            if worker.phase != .signedOut { worker.resume() }
        case .inactive, .background:
            // Never poll for a machine that is not this one while the
            // operator is not looking.
            worker.pause()
        @unknown default:
            worker.pause()
        }
    }
}
