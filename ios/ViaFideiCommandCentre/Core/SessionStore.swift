import Foundation
import WebKit

/// One cookie jar for the whole app, in both directions.
///
/// The brief's requirement — "keep the session as a browser would (persistent
/// cookie storage shared with the WKWebViews so the Admin Site tab is already
/// signed in)" — needs three things to be true at once:
///
///  1. The API calls (`URLSession`) and the two web tabs (`WKWebView`) must
///     present the SAME `vf_session` / `vf_dev_id`. They do not share storage
///     by default: `URLSession` uses `HTTPCookieStorage`, `WKWebView` uses its
///     `WKWebsiteDataStore`. So this type mirrors between them, both ways —
///     signing in through the native form authorises the Admin Site tab, and
///     a session refreshed inside the Admin Site tab authorises the API.
///  2. `vf_dev_id` is the DEVICE credential the middleware sets once and the
///     banned-device check enforces against. Clearing it would make the phone
///     a brand-new device on every launch, so sign-out clears the session
///     cookie and deliberately keeps this one.
///  3. Session material lives in the Keychain, never `UserDefaults`.
@MainActor
final class SessionStore: NSObject, ObservableObject {
    static let shared = SessionStore()

    /// True once a `vf_session` cookie exists. Not proof of a COMPLETED
    /// two-factor sign-in — a pending (password-only) session also has one,
    /// and every endpoint answers 401 until stage two lands. Treated purely
    /// as "worth trying a request before showing the sign-in form".
    @Published private(set) var hasSessionCookie = false

    /// Remembered to pre-fill the sign-in form. The PASSWORD is never stored.
    @Published var rememberedUsername: String = ""

    let urlSession: URLSession

    private let cookieStorage = HTTPCookieStorage.shared
    private var observingWebStore = false

    private enum KeychainAccount {
        static let cookies = "session-cookies"
        static let username = "admin-username"
    }

    private override init() {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = HTTPCookieStorage.shared
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        // These payloads describe a live production workload and the routes
        // already answer `Cache-Control: no-store`; belt and braces.
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 40
        configuration.waitsForConnectivity = false
        urlSession = URLSession(configuration: configuration)
        super.init()

        rememberedUsername = Keychain.string(for: KeychainAccount.username) ?? ""
        restoreFromKeychain()
        refreshFlag()
    }

    // MARK: - the shared web configuration

    /// One persistent data store for both web tabs, so they share cookies with
    /// each other as well as with the API. (A shared `WKProcessPool` used to
    /// be needed for this; since iOS 15 the data store alone is what matters.)
    let websiteDataStore = WKWebsiteDataStore.default()

    func makeWebViewConfiguration() -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = websiteDataStore
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        return configuration
    }

    /// Start watching the web views' cookie store so a session refreshed or
    /// rotated inside a web view reaches the API jar without a round trip.
    func beginObservingWebCookies() {
        guard !observingWebStore else { return }
        observingWebStore = true
        websiteDataStore.httpCookieStore.add(self)
    }

    // MARK: - mirroring

    /// Push the API jar's site cookies into the web views.
    func pushToWebViews() async {
        let cookies = siteCookies()
        guard !cookies.isEmpty else { return }
        for cookie in cookies {
            await websiteDataStore.httpCookieStore.setCookie(cookie)
        }
    }

    /// Pull the web views' site cookies into the API jar.
    func pullFromWebViews() async {
        let cookies = await websiteDataStore.httpCookieStore.allCookies()
        var changed = false
        for cookie in cookies where Endpoints.belongsToSite(cookie) {
            if cookieStorage.cookies?.contains(where: {
                $0.name == cookie.name && $0.domain == cookie.domain && $0.value == cookie.value
            }) != true {
                cookieStorage.setCookie(cookie)
                changed = true
            }
        }
        if changed {
            persistToKeychain()
            refreshFlag()
        }
    }

    /// Called after any request that may have carried `Set-Cookie`.
    func didExchangeCookies() {
        persistToKeychain()
        refreshFlag()
        Task { await pushToWebViews() }
    }

    func rememberUsername(_ username: String) {
        let trimmed = username.trimmingCharacters(in: .whitespacesAndNewlines)
        rememberedUsername = trimmed
        Keychain.setString(trimmed, for: KeychainAccount.username)
    }

    /// Drop the admin session. `vf_dev_id` is kept on purpose (see 2 above).
    func clearSession() async {
        for cookie in siteCookies() where cookie.name == Endpoints.sessionCookieName {
            cookieStorage.deleteCookie(cookie)
        }
        let webCookies = await websiteDataStore.httpCookieStore.allCookies()
        for cookie in webCookies
        where Endpoints.belongsToSite(cookie) && cookie.name == Endpoints.sessionCookieName {
            await websiteDataStore.httpCookieStore.deleteCookie(cookie)
        }
        persistToKeychain()
        refreshFlag()
    }

    // MARK: - internals

    private func siteCookies() -> [HTTPCookie] {
        (cookieStorage.cookies ?? []).filter {
            Endpoints.belongsToSite($0) && Endpoints.cookieNames.contains($0.name)
        }
    }

    private func refreshFlag() {
        let present = siteCookies().contains { $0.name == Endpoints.sessionCookieName }
        if hasSessionCookie != present { hasSessionCookie = present }
    }

    /// A cookie reduced to what `HTTPCookie(properties:)` can rebuild.
    /// `HttpOnly` has no public property key, so a restored cookie is readable
    /// by page JavaScript — the same page's own JavaScript, on the operator's
    /// own device. Nothing here is written anywhere a log can reach.
    private struct StoredCookie: Codable {
        var name: String
        var value: String
        var domain: String
        var path: String
        var expires: Date?
        var secure: Bool
    }

    private func persistToKeychain() {
        let stored = siteCookies().map {
            StoredCookie(
                name: $0.name,
                value: $0.value,
                domain: $0.domain,
                path: $0.path,
                expires: $0.expiresDate,
                secure: $0.isSecure
            )
        }
        guard !stored.isEmpty else {
            Keychain.remove(KeychainAccount.cookies)
            return
        }
        guard let data = try? JSONEncoder().encode(stored) else { return }
        Keychain.set(data, for: KeychainAccount.cookies)
    }

    private func restoreFromKeychain() {
        guard let data = Keychain.data(for: KeychainAccount.cookies),
            let stored = try? JSONDecoder().decode([StoredCookie].self, from: data)
        else { return }
        let now = Date()
        for item in stored {
            if let expires = item.expires, expires <= now { continue }
            var properties: [HTTPCookiePropertyKey: Any] = [
                .name: item.name,
                .value: item.value,
                .domain: item.domain,
                .path: item.path,
            ]
            if let expires = item.expires { properties[.expires] = expires }
            if item.secure { properties[.secure] = "TRUE" }
            if let cookie = HTTPCookie(properties: properties) {
                cookieStorage.setCookie(cookie)
            }
        }
    }
}

extension SessionStore: WKHTTPCookieStoreObserver {
    nonisolated func cookiesDidChange(in cookieStore: WKHTTPCookieStore) {
        Task { @MainActor [weak self] in
            await self?.pullFromWebViews()
        }
    }
}
