import Foundation
import SwiftUI

/// Everything the Admin Worker screen knows, and the only place that decides
/// when to ask the server again.
///
/// THE TWO RULES THIS TYPE EXISTS TO ENFORCE
///
/// 1. THE TOGGLE SHOWS THE DURABLE ROW, NEVER A LOCAL GUESS. `displayedOn` is
///    read straight out of the last server payload. Flipping the switch does
///    not move it; the response does. While the write is in flight the control
///    is inert and spinning, and if the write fails the toggle simply never
///    moved. An optimistic flip that silently diverges from the Mac is exactly
///    the bug the operator asked to be impossible.
///
/// 2. THE PHONE NEVER RUNS THE WORKER. The only mutation in this file is a
///    POST that writes one database row. The Mac's reconcile poll picks it up
///    within its own interval, claims the execution lease, and spawns the
///    worker child — with the Mac's resources. Nothing here starts, schedules,
///    or simulates a pass.
@MainActor
final class WorkerStore: ObservableObject {
    enum Phase: Equatable {
        case loading
        case ready
        /// 401 from any endpoint: no session, a password-only session that
        /// never completed the second factor, or an expired one.
        case signedOut
    }

    /// The life of one switch write, from tap to the Mac obeying.
    enum SwitchPhase: Equatable {
        /// Nothing in flight; the toggle is the durable row.
        case settled
        /// The POST is in flight. The toggle has NOT moved yet.
        case writing(desired: Bool)
        /// The row is written and confirmed; the Mac has not reconciled yet.
        case actuating(desired: Bool, deadline: Date)
        /// The row is written, but the Mac did not pick it up inside the
        /// window. NOT a failed write — a Mac that is not answering.
        case notPickedUp(desired: Bool)
        /// The write itself did not take. The operator has to see this.
        case failed(String)

        var isBusy: Bool {
            if case .writing = self { return true }
            return false
        }
    }

    @Published private(set) var phase: Phase = .loading
    @Published private(set) var switchPhase: SwitchPhase = .settled
    @Published private(set) var status: WorkerStatus?
    @Published private(set) var snapshot: MobileSnapshot?
    @Published private(set) var snapshotCache: SnapshotCache?
    @Published private(set) var statusError: String?
    @Published private(set) var snapshotError: String?
    @Published private(set) var lastStatusAt: Date?
    @Published private(set) var isPolling = false

    /// True while the Admin Worker tab is the one on screen. The other two
    /// tabs are web views; the console behind them still refreshes, just less
    /// often, so coming back to it is instant without paying for a 4-second
    /// poll while the operator reads the site.
    @Published var isFrontmost = true

    private let api: APIClient
    private let network: NetworkMonitor
    private let session: SessionStore

    private var pollTask: Task<Void, Never>?
    private var nextSnapshotAt: Date?

    /// Floor for the status poll. The payload is cached 2 s server-side, so
    /// asking faster than this can only return the same bytes.
    private let baseStatusInterval: TimeInterval = 4
    /// While a switch change is settling, ask more often so the UI resolves
    /// as soon as the Mac obeys rather than on the next lazy tick.
    private let settlingStatusInterval: TimeInterval = 2
    /// Cellular or Low Data Mode: the same information, less often.
    private let frugalStatusInterval: TimeInterval = 8
    /// Offline: no request is even attempted, so this is only how often the
    /// loop wakes to notice that connectivity came back.
    private let offlineRecheckInterval: TimeInterval = 3

    init(api: APIClient = .shared, network: NetworkMonitor = .shared) {
        self.api = api
        self.network = network
        self.session = SessionStore.shared
    }

    // MARK: - what the view renders

    /// The DURABLE switch, exactly as the server last reported it.
    var displayedOn: Bool { status?.master.isOn ?? false }

    /// False when the database could not be read: render "unknown", never
    /// "off". The toggle still works — the row is durable precisely so it can
    /// be written while things are unreachable.
    var switchKnown: Bool { status?.master.isKnown ?? false }

    /// The one condition that dims the toggle: THIS PHONE has no connection.
    /// Never the Mac being asleep, never stale presence, never a degraded
    /// read.
    var switchEnabled: Bool { network.isOnline && !switchPhase.isBusy }

    var isOffline: Bool { !network.isOnline }

    // MARK: - lifecycle

    /// Foreground. Refresh immediately, then keep a poll running.
    func resume() {
        // No session cookie at all: show the sign-in form straight away
        // rather than spending a round trip to be told 401.
        guard session.hasSessionCookie else {
            pause()
            phase = .signedOut
            return
        }
        guard pollTask == nil else { return }
        isPolling = true
        pollTask = Task { [weak self] in
            await self?.loop()
        }
    }

    /// Background. Stop entirely — this app must never drain the battery
    /// watching a machine that is not this one.
    func pause() {
        pollTask?.cancel()
        pollTask = nil
        isPolling = false
    }

    private func loop() async {
        while !Task.isCancelled {
            if network.isOnline {
                await refreshStatus()
                if !Task.isCancelled, snapshotDue {
                    await refreshSnapshot(force: false)
                }
            }
            // Offline: no request is attempted at all. The loop just wakes to
            // notice when the path comes back.
            if Task.isCancelled { return }
            let seconds = currentInterval
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        }
    }

    private var currentInterval: TimeInterval {
        guard network.isOnline else { return offlineRecheckInterval }
        var interval = baseStatusInterval
        switch switchPhase {
        case .writing, .actuating: interval = settlingStatusInterval
        case .settled, .notPickedUp, .failed:
            if !isFrontmost || network.isExpensive || network.isConstrained {
                interval = frugalStatusInterval
            }
        }
        // Never ask faster than the server says a new value can appear.
        if let next = status?.nextPollAfterMs, next > 0 {
            interval = max(interval, next / 1000)
        }
        return interval
    }

    private var snapshotDue: Bool {
        guard let nextSnapshotAt else { return true }
        return Date() >= nextSnapshotAt
    }

    // MARK: - reads

    func refreshStatus() async {
        guard network.isOnline else { return }
        do {
            let fresh = try await api.status()
            apply(fresh)
        } catch is CancellationError {
            return
        } catch APIError.unauthorized {
            handleSignedOut()
        } catch {
            if phase == .loading { phase = .ready }
            statusError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func refreshSnapshot(force: Bool) async {
        guard network.isOnline else { return }
        do {
            let response = try await api.snapshot(force: force)
            if let status = response.status { apply(status) }
            if let payload = response.snapshot { snapshot = payload }
            snapshotCache = response.cache
            snapshotError = nil
            let wait = response.cache?.nextPoll ?? 30
            nextSnapshotAt = Date().addingTimeInterval(wait)
        } catch is CancellationError {
            return
        } catch APIError.unauthorized {
            handleSignedOut()
        } catch {
            snapshotError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            // Back off a little so a failing snapshot does not retry on every
            // status tick.
            nextSnapshotAt = Date().addingTimeInterval(30)
        }
    }

    /// Pull to refresh: both payloads, and the snapshot deliberately bypasses
    /// its cache. That is the only phone-triggered path that runs the ~30
    /// production queries on demand, and the server rate-limits it to six per
    /// five minutes — the refusal is surfaced rather than swallowed.
    func refreshEverything() async {
        guard network.isOnline else {
            statusError = APIError.offline.errorDescription
            return
        }
        await refreshStatus()
        await refreshSnapshot(force: true)
    }

    private func apply(_ fresh: WorkerStatus) {
        status = fresh
        lastStatusAt = Date()
        statusError = nil
        if phase != .ready { phase = .ready }
        reconcileSwitch(with: fresh)
    }

    // MARK: - the switch

    /// Write the durable row, then show what the server confirms.
    func requestSwitch(_ desired: Bool) {
        guard network.isOnline else { return }
        guard !switchPhase.isBusy else { return }
        Task { await performSwitch(desired) }
    }

    private func performSwitch(_ desired: Bool) async {
        switchPhase = .writing(desired: desired)
        do {
            let response = try await api.setSwitch(on: desired)
            // Take the server's whole view first: the response carries the
            // freshly invalidated status, so the toggle moves off real data.
            if let carried = response.status {
                status = carried
                lastStatusAt = Date()
                statusError = nil
                if phase != .ready { phase = .ready }
            }
            guard let confirmed = response.switchState else {
                switchPhase = .failed("The server did not confirm the change. Pull to refresh.")
                await refreshStatus()
                return
            }
            guard confirmed.isKnown else {
                switchPhase = .failed(
                    "The switch was written but could not be read back. Pull to refresh.")
                await refreshStatus()
                return
            }
            guard confirmed.isOn == desired else {
                switchPhase = .failed(
                    "The durable switch is \(confirmed.isOn ? "ON" : "OFF") — the change did not take."
                )
                await refreshStatus()
                return
            }
            let window =
                response.actuation?.window ?? status?.cadence.pendingWindow ?? 15
            switchPhase = .actuating(
                desired: desired, deadline: Date().addingTimeInterval(window))
            // Ask again straight away: if the Mac was already in the right
            // state (or is quick), this settles the UI immediately.
            await refreshStatus()
        } catch is CancellationError {
            switchPhase = .settled
        } catch APIError.unauthorized {
            switchPhase = .settled
            handleSignedOut()
        } catch {
            let message =
                (error as? APIError)?.errorDescription
                ?? "The switch was not changed: \(error.localizedDescription)"
            switchPhase = .failed(message)
            // Re-read so the toggle shows the truth rather than the attempt.
            await refreshStatus()
        }
    }

    /// Reconcile the pending write against every fresh reading.
    private func reconcileSwitch(with fresh: WorkerStatus) {
        switch switchPhase {
        case .settled, .failed:
            return
        case .writing:
            // The write's own response is what settles it; a poll landing
            // mid-flight must not pre-empt that.
            return
        case .actuating(let desired, let deadline):
            if fresh.master.isKnown, fresh.master.isOn != desired {
                // Someone else moved it back (the Mac menu, the desktop
                // console). The durable row is the truth; stop waiting.
                switchPhase = .settled
            } else if hasActuated(fresh, desired: desired) {
                switchPhase = .settled
            } else if Date() >= deadline {
                switchPhase = .notPickedUp(desired: desired)
            }
        case .notPickedUp(let desired):
            if fresh.master.isKnown, fresh.master.isOn != desired {
                switchPhase = .settled
            } else if hasActuated(fresh, desired: desired) {
                switchPhase = .settled
            }
        }
    }

    /// Has the MAC made reality match the row yet?
    private func hasActuated(_ fresh: WorkerStatus, desired: Bool) -> Bool {
        // An unreadable execution state is not evidence either way.
        guard fresh.exec.isKnown else { return false }
        if desired {
            if fresh.exec.isExecutingLocally { return true }
            let runState = fresh.mac.runState
            return fresh.mac.isWorkerRunning || runState == "running" || runState == "starting"
        }
        return !fresh.exec.isExecutingLocally && !fresh.mac.isWorkerRunning
    }

    func dismissSwitchMessage() {
        switch switchPhase {
        case .failed, .notPickedUp: switchPhase = .settled
        default: break
        }
    }

    // MARK: - session

    func handleSignedOut() {
        pause()
        status = nil
        snapshot = nil
        snapshotCache = nil
        nextSnapshotAt = nil
        switchPhase = .settled
        phase = .signedOut
    }

    func signedInAgain() {
        phase = .loading
        statusError = nil
        snapshotError = nil
        nextSnapshotAt = nil
        resume()
    }

    func signOut() async {
        pause()
        try? await api.signOut()
        await session.clearSession()
        handleSignedOut()
    }
}
