import Foundation

enum APIError: Error, LocalizedError, Equatable {
    /// The PHONE has no path to the network. Distinct from every server-side
    /// condition because it is the only one that dims the switch.
    case offline
    /// 401 — no session, a PENDING (password-only) session, or an expired one.
    case unauthorized
    case rateLimited(retryAfter: TimeInterval?)
    /// The server answered, and said no.
    case server(status: Int, code: String?, message: String?)
    case malformed(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .offline:
            return "No internet connection."
        case .unauthorized:
            return "Signed out. Sign in again to continue."
        case .rateLimited(let retryAfter):
            if let retryAfter {
                return "Too many requests. Try again in \(Int(retryAfter.rounded()))s."
            }
            return "Too many requests. Try again shortly."
        case .server(let status, let code, let message):
            if let message, !message.isEmpty { return Self.friendly(message) }
            if let code, !code.isEmpty { return Self.friendly(code) }
            return "The server returned \(status)."
        case .malformed(let detail):
            return "Unexpected response from the server (\(detail))."
        case .transport(let detail):
            return detail
        }
    }

    private static func friendly(_ raw: String) -> String {
        switch raw {
        case "switch_write_failed":
            return "The switch was NOT changed — the database write failed."
        case "worker_status_unavailable":
            return "Worker status is unavailable right now."
        case "worker_snapshot_unavailable":
            return "The command-centre snapshot is unavailable right now."
        case "forbidden", "csrf":
            return "The server refused the request."
        default:
            return Formatting.humanise(raw)
        }
    }
}

/// Outcome of stage one of the two-stage admin sign-in.
enum LoginStage: Equatable {
    /// Password accepted; a six-digit code was emailed.
    case codeSent
    /// Password accepted; the code could not be emailed.
    case codeSentUndelivered
    /// Refused — wrong credentials, or rate limited.
    case refused
}

/// Outcome of stage two.
enum VerifyOutcome: Equatable {
    /// Signed in. `vf_session` is now an ADMIN session.
    case signedIn
    /// Wrong code — the same challenge is still live, try again.
    case wrongCode
    /// The attempt is over (expired, exhausted, consumed, superseded).
    case startOver
}

/// The app's entire outbound surface.
///
/// It makes authenticated HTTPS calls and decodes JSON. There is no database
/// driver here, no worker entry point, no ingest: the switch is a durable row
/// and the Mac's reconcile poll actuates it. See `ios/README.md`.
final class APIClient: @unchecked Sendable {
    static let shared = APIClient()

    private let decoder = JSONDecoder()

    /// The 303s that carry the sign-in state machine must NOT be followed —
    /// following one lands on an HTML page and loses the `Location` that says
    /// what happened.
    private final class RedirectBlocker: NSObject, URLSessionTaskDelegate {
        func urlSession(
            _ session: URLSession,
            task: URLSessionTask,
            willPerformHTTPRedirection response: HTTPURLResponse,
            newRequest request: URLRequest
        ) async -> URLRequest? {
            nil
        }
    }

    private let redirectBlocker = RedirectBlocker()

    // MARK: - reads

    func status() async throws -> WorkerStatus {
        let request = get(Endpoints.workerStatus)
        let payload: StatusResponse = try await send(request)
        guard let status = payload.status else { throw APIError.malformed("status missing") }
        return status
    }

    func snapshot(force: Bool) async throws -> SnapshotResponse {
        let url = force ? Endpoints.workerSnapshotForced : Endpoints.workerSnapshot
        let request = get(url)
        return try await send(request)
    }

    // MARK: - the one mutation

    /// Write the durable master switch. Writes the row and nothing else: the
    /// Mac claims the execution lease and spawns the worker child itself.
    func setSwitch(on: Bool) async throws -> SwitchResponse {
        var request = post(Endpoints.workerSwitch)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "on": on,
            "client": Endpoints.switchClient,
            "reason": on ? "operator turned the worker on from iPhone"
                : "operator turned the worker off from iPhone",
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(request)
    }

    // MARK: - auth

    func signIn(username: String, password: String) async throws -> LoginStage {
        var request = post(Endpoints.login)
        request.setValue(
            "application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Self.form(["username": username, "password": password])
        let location = try await redirectLocation(request)
        if location.contains("stage=code") {
            return location.contains("notice=undelivered") ? .codeSentUndelivered : .codeSent
        }
        return .refused
    }

    func verify(code: String) async throws -> VerifyOutcome {
        var request = post(Endpoints.verifyCode)
        request.setValue(
            "application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Self.form(["code": code])
        let location = try await redirectLocation(request)
        if location.hasPrefix("/admin?welcome") || location.contains("/admin?welcome") {
            return .signedIn
        }
        if location.contains("error=code") { return .wrongCode }
        return .startOver
    }

    func resendCode() async throws {
        var request = post(Endpoints.resendCode)
        request.setValue(
            "application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data()
        _ = try await redirectLocation(request)
    }

    func signOut() async throws {
        var request = post(Endpoints.logout)
        request.setValue(
            "application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data()
        _ = try? await redirectLocation(request)
    }

    // MARK: - request building

    private func get(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        return request
    }

    /// Every mutation carries `Origin` verbatim, plus `Referer` as the
    /// documented fallback. `evaluateCsrf` refuses a POST carrying neither
    /// with 403 before authentication is even consulted, and its trusted set
    /// is a server-side constant — this header cannot widen it.
    private func post(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(Endpoints.originValue, forHTTPHeaderField: "Origin")
        request.setValue(Endpoints.refererValue, forHTTPHeaderField: "Referer")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        return request
    }

    private static func form(_ fields: [String: String]) -> Data {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        let encoded = fields.map { key, value in
            let name = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
            let raw = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
            return "\(name)=\(raw)"
        }
        return encoded.joined(separator: "&").data(using: .utf8) ?? Data()
    }

    // MARK: - transport

    /// A 3xx whose `Location` is the answer. Never followed.
    private func redirectLocation(_ request: URLRequest) async throws -> String {
        let (data, response) = try await perform(request)
        await MainActor.run { SessionStore.shared.didExchangeCookies() }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.malformed("no HTTP response")
        }
        if (300...399).contains(http.statusCode) {
            guard let location = http.value(forHTTPHeaderField: "Location") else {
                throw APIError.malformed("redirect without Location")
            }
            return location
        }
        if http.statusCode == 429 {
            throw APIError.rateLimited(retryAfter: Self.retryAfter(http))
        }
        // A non-redirect answer here means the request was refused before the
        // state machine ran (CSRF, banned device, malformed body).
        throw Self.serverError(status: http.statusCode, data: data)
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await perform(request)
        await MainActor.run { SessionStore.shared.didExchangeCookies() }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.malformed("no HTTP response")
        }
        switch http.statusCode {
        case 200...299:
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.malformed("could not read the payload")
            }
        case 401:
            throw APIError.unauthorized
        case 429:
            throw APIError.rateLimited(retryAfter: Self.retryAfter(http))
        default:
            throw Self.serverError(status: http.statusCode, data: data)
        }
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        let session = await MainActor.run { SessionStore.shared.urlSession }
        do {
            return try await session.data(for: request, delegate: redirectBlocker)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed,
                .internationalRoamingOff:
                throw APIError.offline
            case .timedOut:
                throw APIError.transport("The request timed out.")
            case .cancelled:
                throw CancellationError()
            default:
                throw APIError.transport("Could not reach etviafidei.com.")
            }
        }
    }

    private static func retryAfter(_ http: HTTPURLResponse) -> TimeInterval? {
        guard let raw = http.value(forHTTPHeaderField: "Retry-After"),
            let seconds = TimeInterval(raw)
        else { return nil }
        return seconds
    }

    private static func serverError(status: Int, data: Data) -> APIError {
        let body = try? JSONDecoder().decode(APIErrorBody.self, from: data)
        return .server(status: status, code: body?.error, message: body?.message)
    }
}
