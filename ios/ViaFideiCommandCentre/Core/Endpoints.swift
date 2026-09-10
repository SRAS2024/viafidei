import Foundation

/// Every URL and header value the app is allowed to talk to.
///
/// Deliberately a closed list. The phone is a remote control for a worker that
/// runs on the Mac: it speaks to the deployed Next.js app over HTTPS and to
/// nothing else. There is no database URL here, no loopback host, no worker
/// entry point — see `README.md` in `ios/` for why that is structural rather
/// than a matter of discipline.
enum Endpoints {
    /// The canonical production origin. `evaluateCsrf` on the server derives
    /// its trusted set from `src/lib/config.ts`, never from a request header,
    /// and that set is exactly `https://etviafidei.com` and its `www` alias.
    static let originValue = "https://etviafidei.com"

    /// Sent verbatim as `Origin:` on every mutation. A POST carrying neither
    /// `Origin` nor an acceptable `Referer` is refused 403 before the server
    /// even consults the session.
    static let refererValue = "https://etviafidei.com/admin"

    static let standardSite = URL(string: "https://etviafidei.com/")!
    static let adminSite = URL(string: "https://etviafidei.com/admin")!

    static let login = URL(string: "https://etviafidei.com/api/admin/login")!
    static let verifyCode = URL(string: "https://etviafidei.com/api/auth/admin-2fa/verify")!
    static let resendCode = URL(string: "https://etviafidei.com/api/auth/admin-2fa/resend")!
    static let logout = URL(string: "https://etviafidei.com/api/admin/logout")!

    static let workerStatus = URL(string: "https://etviafidei.com/api/admin/worker/status")!
    static let workerSnapshot = URL(string: "https://etviafidei.com/api/admin/worker/snapshot")!
    static let workerSnapshotForced = URL(string: "https://etviafidei.com/api/admin/worker/snapshot?refresh=1")!
    static let workerSwitch = URL(string: "https://etviafidei.com/api/admin/worker/switch")!

    /// Recorded in `MasterSwitch.changedFrom` and shown on both consoles as
    /// "changed by <operator> from <client>", so the Mac says out loud that
    /// the phone did it.
    static let switchClient = "iphone-app"

    /// The two cookies that constitute the session. Persisted to the Keychain
    /// and mirrored into the web views so the Admin Site tab is already
    /// signed in. Both are HttpOnly + SameSite=Lax + Secure server-side.
    static let deviceCookieName = "vf_dev_id"
    static let sessionCookieName = "vf_session"

    static let cookieNames: Set<String> = [deviceCookieName, sessionCookieName]

    /// Cookie domains we mirror between the API jar and the web views.
    static func belongsToSite(_ cookie: HTTPCookie) -> Bool {
        let domain = cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
        return domain == "etviafidei.com" || domain.hasSuffix(".etviafidei.com")
    }
}
