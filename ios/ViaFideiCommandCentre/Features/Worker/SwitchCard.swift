import SwiftUI

/// The power switch, and the honest account of what it is doing.
///
/// CONNECTIVITY, exactly as revised by the operator: the toggle dims and
/// becomes genuinely non-interactive when THIS PHONE has no connection, with
/// "No internet" shown directly BELOW the switch. Nothing about the Mac ever
/// dims it — not a stale presence row, not a degraded database read, not a
/// worker that crashed. The switch is a durable row precisely so it can be
/// written while the Mac is away and honoured when it comes back.
struct SwitchCard: View {
    @ObservedObject var store: WorkerStore

    /// LOAD-BEARING, and not obviously so: this is the subscription that makes
    /// the dimming actually appear.
    ///
    /// `store.switchEnabled` is computed from `NetworkMonitor.shared`, which
    /// `WorkerStore` holds as a plain reference — flipping `isOnline` therefore
    /// publishes nothing on the store, and a view observing only the store may
    /// never re-render. SwiftUI skips a child whose stored properties compare
    /// unchanged, so the switch could stay bright and tappable-looking with the
    /// phone offline until some unrelated state happened to move. Observing the
    /// monitor here subscribes this view to the one value that dims it.
    /// Do not remove it because "the view does not use network for anything".
    @ObservedObject var network: NetworkMonitor = .shared

    @Environment(\.dynamicTypeSize) private var typeSize

    /// The one condition that dims the toggle: THIS PHONE has no connection.
    /// Read from the monitor this view observes, so the change is delivered.
    private var isOffline: Bool { !network.isOnline }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            topRow
            Divider().overlay(Theme.hairline)
            executionLine
            bannerIfAny
            disclaimer
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.cardPadding)
        .background(cardShape)
    }

    private var cardShape: some View {
        RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
            .fill(Theme.card)
    }

    @ViewBuilder private var topRow: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 14) {
                heading
                switchColumn.frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            HStack(alignment: .top, spacing: 16) {
                heading
                Spacer(minLength: 8)
                switchColumn
            }
        }
    }

    private var executionLine: some View {
        Text(store.status?.exec.displayLabel ?? "Reading the execution state…")
            .font(.footnote)
            .foregroundStyle(Theme.muted)
            .fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder private var bannerIfAny: some View {
        if let note = actuationNote {
            if dismissible {
                ActuationBanner(note: note, onDismiss: { store.dismissSwitchMessage() })
            } else {
                ActuationBanner(note: note, onDismiss: nil)
            }
        }
    }

    private var disclaimer: some View {
        Text(
            "Turning this on runs the Admin Worker on the Mac, with the Mac's resources. This phone never runs it."
        )
        .font(.caption)
        .foregroundStyle(Theme.faint)
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - pieces

    private var heading: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 9) {
                Circle()
                    .fill(headlineTone.color)
                    .frame(width: 11, height: 11)
                    .padding(.top, 8)
                    .accessibilityHidden(true)
                Text(headline)
                    .font(Theme.display(.title2))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let attribution = store.status?.master.attribution {
                Text(attribution)
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
            }
            if let changed = store.status?.master.changedDate {
                Text("Changed \(Formatting.ago(changed))")
                    .font(.caption)
                    .foregroundStyle(Theme.faint)
            }
        }
    }

    /// The switch, with its caption directly underneath it.
    private var switchColumn: some View {
        VStack(alignment: typeSize.isAccessibilitySize ? .leading : .trailing, spacing: 6) {
            Toggle(
                "Admin Worker",
                isOn: Binding(
                    get: { store.displayedOn },
                    set: { store.requestSwitch($0) }
                )
            )
            .labelsHidden()
            .toggleStyle(.switch)
            .tint(.accentColor)
            .disabled(!store.switchEnabled)
            // Genuinely non-interactive, and it looks it.
            .opacity(store.switchEnabled ? 1 : 0.35)
            .saturation(store.switchEnabled ? 1 : 0)
            .accessibilityLabel("Admin Worker")
            .accessibilityHint(
                isOffline
                    ? "Unavailable while this iPhone has no internet connection."
                    : "Turns the Admin Worker on or off. It runs on the Mac."
            )

            // BELOW the switch, as asked.
            if isOffline {
                Text("No internet")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.muted)
                    .accessibilityLabel("No internet connection")
            } else if case .writing = store.switchPhase {
                HStack(spacing: 5) {
                    ProgressView().controlSize(.mini)
                    Text("Saving…").font(.caption).foregroundStyle(Theme.muted)
                }
            } else if !store.switchKnown, store.status != nil {
                Text("Unknown")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.waiting)
            }
        }
        .frame(minWidth: 62, alignment: typeSize.isAccessibilitySize ? .leading : .trailing)
    }

    // MARK: - wording

    private var headline: String {
        guard let status = store.status else { return "Reading…" }
        return status.master.headline
    }

    private var headlineTone: StatusTone {
        guard let status = store.status else { return .unknown }
        if !status.master.isKnown { return .unknown }
        if !status.master.isOn { return .neutral }
        return status.exec.isExecutingLocally ? .good : .caution
    }

    private var dismissible: Bool {
        switch store.switchPhase {
        case .failed, .notPickedUp: return true
        default: return false
        }
    }

    private var actuationNote: ActuationBanner.Note? {
        switch store.switchPhase {
        case .settled, .writing:
            return nil
        case .actuating(let desired, _):
            let latency = store.status?.cadence.expectedLatency ?? 9
            return .init(
                tone: .caution,
                icon: "clock.arrow.circlepath",
                title: "Saved — waiting for the Mac",
                body:
                    "The switch is \(desired ? "ON" : "OFF") in the database. The Mac reconciles on its own poll, usually within \(Formatting.duration(seconds: latency))."
            )
        case .notPickedUp(let desired):
            return .init(
                tone: .caution,
                icon: "exclamationmark.triangle",
                title: "Saved, but the Mac has not picked it up",
                body:
                    "The durable switch is \(desired ? "ON" : "OFF") and will be honoured when the Mac answers. \(store.status?.mac.displayLabel ?? "")"
            )
        case .failed(let message):
            return .init(
                tone: .bad,
                icon: "xmark.octagon",
                title: "The switch did not change",
                body: message
            )
        }
    }
}

/// The strip under the switch that explains a pending or failed change.
struct ActuationBanner: View {
    struct Note {
        let tone: StatusTone
        let icon: String
        let title: String
        let body: String
    }

    let note: Note
    var onDismiss: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: note.icon)
                .font(.subheadline)
                .foregroundStyle(note.tone.color)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(note.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(note.body)
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            if let onDismiss {
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.faint)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss")
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            note.tone.color.opacity(0.12),
            in: RoundedRectangle(cornerRadius: 12, style: .continuous)
        )
        .accessibilityElement(children: .combine)
    }
}
