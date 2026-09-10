import SwiftUI
import WebKit

/// One long-lived web view per site tab.
///
/// Held by the tab as a `@StateObject` so switching tabs does not throw the
/// page away and sign the operator out of the Admin Site, and built from
/// `SessionStore.makeWebViewConfiguration()` so both tabs and the API share a
/// single persistent cookie jar.
@MainActor
final class WebTabModel: NSObject, ObservableObject {
    @Published private(set) var title: String = ""
    @Published private(set) var progress: Double = 0
    @Published private(set) var isLoading = false
    @Published private(set) var canGoBack = false
    @Published private(set) var canGoForward = false
    @Published private(set) var failure: String?

    let home: URL
    private(set) var webView: WKWebView!
    private var observations: [NSKeyValueObservation] = []
    private var hasLoaded = false

    init(home: URL) {
        self.home = home
        super.init()
        let view = WKWebView(frame: .zero, configuration: SessionStore.shared.makeWebViewConfiguration())
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        view.scrollView.keyboardDismissMode = .interactive
        webView = view

        observations = [
            view.observe(\.estimatedProgress, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.progress = view.estimatedProgress }
            },
            view.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.isLoading = view.isLoading }
            },
            view.observe(\.title, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.title = view.title ?? "" }
            },
            view.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.canGoBack = view.canGoBack }
            },
            view.observe(\.canGoForward, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.canGoForward = view.canGoForward }
            },
        ]
    }

    /// First load. Pushes the API session into the web cookie store first, so
    /// the Admin Site tab opens already signed in rather than at a login form.
    func loadIfNeeded() {
        guard !hasLoaded else { return }
        hasLoaded = true
        Task {
            await SessionStore.shared.pushToWebViews()
            SessionStore.shared.beginObservingWebCookies()
            reload()
        }
    }

    func reload() {
        failure = nil
        if webView.url == nil {
            webView.load(URLRequest(url: home, cachePolicy: .reloadRevalidatingCacheData))
        } else {
            webView.reloadFromOrigin()
        }
    }

    func goHome() {
        failure = nil
        webView.load(URLRequest(url: home))
    }

    func goBack() { webView.goBack() }
    func goForward() { webView.goForward() }
}

extension WebTabModel: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        failure = nil
        // A session refreshed or rotated inside the web view has to reach the
        // API jar, or the next status poll 401s for no visible reason.
        Task { await SessionStore.shared.pullFromWebViews() }
    }

    func webView(
        _ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error
    ) {
        note(error)
    }

    func webView(
        _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        note(error)
    }

    private func note(_ error: Error) {
        let code = (error as NSError).code
        // A navigation the app itself replaced is not a failure worth showing.
        guard code != NSURLErrorCancelled else { return }
        failure = error.localizedDescription
    }
}

extension WebTabModel: WKUIDelegate {
    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // `target="_blank"` would otherwise silently do nothing.
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }
}

/// The UIKit bridge. Deliberately dumb: the model owns the web view, so this
/// never recreates one on a state change.
struct SiteWebView: UIViewRepresentable {
    @ObservedObject var model: WebTabModel

    func makeUIView(context: Context) -> WKWebView {
        model.loadIfNeeded()
        return model.webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
