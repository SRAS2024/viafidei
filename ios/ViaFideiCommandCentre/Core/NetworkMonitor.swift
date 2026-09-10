import Foundation
import Network

/// Whether *this phone* has a usable path to the internet.
///
/// This is the one and only reason the master switch is ever disabled. Per the
/// operator's revision: the toggle dims when the PHONE is offline, with
/// "No internet" directly below it. It is never dimmed because the Mac is
/// asleep, because host presence is stale, or because the database read came
/// back unknown — the switch is a durable row precisely so it can be written
/// while the Mac is away and honoured when it wakes.
final class NetworkMonitor: ObservableObject {
    /// One monitor for the app. `NWPathMonitor` costs a system callback per
    /// path change; there is no reason to run three of them.
    static let shared = NetworkMonitor()

    /// Optimistic until the first path update lands, so the switch is not
    /// dimmed for the fraction of a second before `NWPathMonitor` reports.
    @Published private(set) var isOnline = true

    /// Cellular / hotspot. Used only to lengthen the poll interval, never to
    /// disable anything.
    @Published private(set) var isExpensive = false

    /// Low Data Mode. Same: cadence only.
    @Published private(set) var isConstrained = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.viafidei.commandcentre.network")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            let expensive = path.isExpensive
            let constrained = path.isConstrained
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                if self.isOnline != online { self.isOnline = online }
                if self.isExpensive != expensive { self.isExpensive = expensive }
                if self.isConstrained != constrained { self.isConstrained = constrained }
            }
        }
        monitor.start(queue: queue)
    }

    deinit { monitor.cancel() }
}
