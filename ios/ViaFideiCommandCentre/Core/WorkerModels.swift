import Foundation

/// `GET /api/admin/worker/status`, decoded.
///
/// Every field is Optional even where the contract promises it, and every
/// accessor has a documented default. A schema drift on the server must
/// degrade one row of this screen, never blank the command centre — and,
/// critically, must never turn an unreadable value into a confident "OFF".
struct WorkerStatus: Decodable {
    var at: String?
    var switchState: MasterSwitchView?
    var execution: ExecutionView?
    var host: HostView?
    var worker: WorkerRuntimeView?
    var actuation: ActuationView?
    var degraded: Bool?
    var cacheAgeMs: Double?
    var nextPollAfterMs: Double?

    private enum CodingKeys: String, CodingKey {
        case at
        case switchState = "switch"
        case execution, host, worker, actuation, degraded, cacheAgeMs, nextPollAfterMs
    }

    var master: MasterSwitchView { switchState ?? MasterSwitchView() }
    var exec: ExecutionView { execution ?? ExecutionView() }
    var mac: HostView { host ?? HostView() }
    var runtime: WorkerRuntimeView { worker ?? WorkerRuntimeView() }
    var cadence: ActuationView { actuation ?? ActuationView() }
    var isDegraded: Bool { degraded ?? false }
    var observedAt: Date? { ISO.date(at) }
}

/// The durable master switch. `known == false` means the DATABASE could not be
/// read; `on` is then only a default and must be rendered as "unknown".
struct MasterSwitchView: Decodable {
    var on: Bool?
    var changedAt: String?
    var changedBy: String?
    var changedFrom: String?
    var known: Bool?
    var error: String?

    var isOn: Bool { on ?? false }
    var isKnown: Bool { known ?? false }
    var changedDate: Date? { ISO.date(changedAt) }

    /// What the header reads. Never collapses "unknown" into "off".
    var headline: String {
        guard isKnown else { return "Switch state unknown" }
        return isOn ? "Admin Worker ON" : "Admin Worker OFF"
    }

    var attribution: String? {
        guard isKnown, let by = changedBy, !by.isEmpty else { return nil }
        if let from = changedFrom, !from.isEmpty {
            return "Set by \(by) from \(from)"
        }
        return "Set by \(by)"
    }
}

struct LeaseView: Decodable {
    var runtimeId: String?
    var hostLabel: String?
    var origin: String?
    var pid: Int?
    var acquiredAt: String?
    var renewedAt: String?
    var ageMs: Double?
    var live: Bool?
}

struct ExecutionView: Decodable {
    var state: String?
    var label: String?
    var known: Bool?
    var leaseLive: Bool?
    var leaseAgeMs: Double?
    var executingLocally: Bool?
    var lease: LeaseView?
    var error: String?

    var isKnown: Bool { known ?? false }
    var isExecutingLocally: Bool { executingLocally ?? false }
    var isLeaseLive: Bool { leaseLive ?? false }
    var stateValue: String { state ?? "OFF" }

    var displayLabel: String {
        if !isKnown { return "Execution state unknown — the database could not be read." }
        if let label, !label.isEmpty { return label }
        return stateValue
    }
}

/// "Is the MAC APP up?" — display only. Four cases the UI renders distinctly;
/// none of them ever disables the toggle.
struct HostView: Decodable {
    var alive: Bool?
    var known: Bool?
    var ageMs: Double?
    var label: String?
    var runtimeId: String?
    var hostLabel: String?
    var runState: String?
    var workerRunning: Bool?
    var workerStartedAt: String?
    var switchOn: Bool?
    var failureReason: String?
    var leaseHeldElsewhere: Bool?
    var error: String?

    enum Presence {
        /// Fresh presence row: the Mac is up and reconciling.
        case alive
        /// Seen before, not answering now — asleep, offline, killed.
        case silent
        /// No row at all: quit cleanly, or never launched.
        case absent
        /// The DATABASE could not be read. Unknown, NOT "Mac off".
        case unknown
    }

    var presence: Presence {
        guard known ?? false else { return .unknown }
        if alive ?? false { return .alive }
        return runtimeId == nil ? .absent : .silent
    }

    var isWorkerRunning: Bool { workerRunning ?? false }
    var isLeaseHeldElsewhere: Bool { leaseHeldElsewhere ?? false }
    var startedDate: Date? { ISO.date(workerStartedAt) }

    /// The server already ships a ready one-liner covering all four cases.
    var displayLabel: String {
        if let label, !label.isEmpty { return label }
        switch presence {
        case .alive: return "Mac runtime alive."
        case .silent: return "The Mac was seen but is not answering."
        case .absent: return "No Mac runtime has checked in."
        case .unknown: return "Mac runtime unknown — the database could not be read."
        }
    }
}

/// "Is the WORKER working?" — distinct from host presence on purpose.
struct WorkerRuntimeView: Decodable {
    var live: Bool?
    var heartbeatAt: String?
    var heartbeatAgeMs: Double?
    var mode: String?
    var priority: String?
    var goal: String?
    var task: String?
    var blocker: String?
    var lastSuccessfulAt: String?
    var lastFailedAt: String?
    var workerVersion: String?
    var paused: Bool?
    var pausedReason: String?
    var known: Bool?

    var isLive: Bool { live ?? false }
    var isPaused: Bool { paused ?? false }
    var isKnown: Bool { known ?? false }
    var heartbeatDate: Date? { ISO.date(heartbeatAt) }
    var lastSuccessDate: Date? { ISO.date(lastSuccessfulAt) }
    var lastFailureDate: Date? { ISO.date(lastFailedAt) }
}

/// Cadence facts from the server, so the phone hard-codes no timing.
struct ActuationView: Decodable {
    var hostPollIntervalMs: Double?
    var hostSwitchCacheMs: Double?
    var expectedLatencyMs: Double?
    var pendingWindowMs: Double?

    /// 15 s is the contract's default; the server value wins when present.
    var pendingWindow: TimeInterval { (pendingWindowMs ?? 15_000) / 1000 }
    var expectedLatency: TimeInterval { (expectedLatencyMs ?? 9_000) / 1000 }
}

// MARK: - responses

struct StatusResponse: Decodable {
    var ok: Bool?
    var status: WorkerStatus?
}

struct SwitchResponse: Decodable {
    var ok: Bool?
    /// The CONFIRMED durable value the server just wrote. This — never the
    /// value the phone asked for — is what the toggle settles on.
    var switchState: MasterSwitchView?
    var previousOn: Bool?
    var status: WorkerStatus?
    var actuation: SwitchActuation?

    private enum CodingKeys: String, CodingKey {
        case ok
        case switchState = "switch"
        case previousOn, status, actuation
    }
}

struct SwitchActuation: Decodable {
    var pending: Bool?
    var windowMs: Double?
    var note: String?

    var window: TimeInterval { (windowMs ?? 15_000) / 1000 }
}

struct SnapshotResponse: Decodable {
    var ok: Bool?
    var status: WorkerStatus?
    var snapshot: MobileSnapshot?
    var cache: SnapshotCache?
}

struct SnapshotCache: Decodable {
    var cached: Bool?
    var ageMs: Double?
    var ttlMs: Double?
    var coalesced: Bool?
    var nextPollAfterMs: Double?
    var forced: Bool?

    var nextPoll: TimeInterval { max(15, (nextPollAfterMs ?? 30_000) / 1000) }
}

/// The server's error envelope: `{ ok:false, error, message?, details? }`.
struct APIErrorBody: Decodable {
    var ok: Bool?
    var error: String?
    var message: String?
}

// MARK: - ISO helpers

enum ISO {
    private static let withFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func date(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        return withFraction.date(from: value) ?? plain.date(from: value)
    }
}
