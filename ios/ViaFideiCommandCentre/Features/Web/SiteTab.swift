import SwiftUI

/// A whole site, in a tab: the page, a thin progress line, and the three
/// controls a phone actually needs (back, forward, reload).
struct SiteTab: View {
    @StateObject private var model: WebTabModel
    @ObservedObject var network: NetworkMonitor
    let screenTitle: String

    init(home: URL, title: String, network: NetworkMonitor) {
        _model = StateObject(wrappedValue: WebTabModel(home: home))
        self.screenTitle = title
        self.network = network
    }

    var body: some View {
        VStack(spacing: 0) {
            if model.isLoading {
                ProgressView(value: max(model.progress, 0.03))
                    .progressViewStyle(.linear)
                    .tint(.accentColor)
                    .frame(height: 2)
                    .accessibilityHidden(true)
            }

            ZStack {
                SiteWebView(model: model)
                    .ignoresSafeArea(.container, edges: .bottom)

                if let failure = model.failure {
                    failureOverlay(failure)
                }
            }
        }
        .background(Theme.pageBackground)
        .navigationTitle(model.title.isEmpty ? screenTitle : model.title)
        .navigationBarTitleDisplayMode(.inline)
        // Navigation lives in the TOP bar, not the bottom one: the tab bar
        // already owns the bottom of the screen, and a `.bottomBar` toolbar
        // collides with it.
        .toolbar {
            ToolbarItemGroup(placement: .topBarLeading) {
                Button { model.goBack() } label: { Image(systemName: "chevron.backward") }
                    .disabled(!model.canGoBack)
                    .accessibilityLabel("Back")
                Button { model.goForward() } label: { Image(systemName: "chevron.forward") }
                    .disabled(!model.canGoForward)
                    .accessibilityLabel("Forward")
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { model.goHome() } label: { Image(systemName: "house") }
                    .accessibilityLabel("Home")
                Button { model.reload() } label: { Image(systemName: "arrow.clockwise") }
                    .accessibilityLabel("Reload")
            }
        }
    }

    private func failureOverlay(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: network.isOnline ? "exclamationmark.triangle" : "wifi.slash")
                .font(.largeTitle)
                .foregroundStyle(Theme.muted)
            Text(network.isOnline ? "This page did not load" : "No internet")
                .font(Theme.display(.headline))
                .foregroundStyle(Theme.ink)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Try again") { model.reload() }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.pageBackground)
    }
}
