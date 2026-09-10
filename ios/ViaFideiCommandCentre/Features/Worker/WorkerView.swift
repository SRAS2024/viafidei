import SwiftUI

/// The primary screen: the command centre.
///
/// Reads top to bottom as an answer to "what is the worker doing right now" —
/// the switch, then whether the Mac is there to obey it, then what the worker
/// is working on, then how much has actually been published. Everything
/// deeper folds away so the first screenful is never a wall of tables.
struct WorkerView: View {
    @ObservedObject var store: WorkerStore
    @State private var showingAccount = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: Theme.stackSpacing) {
                SwitchCard(store: store)

                if let message = store.statusError {
                    ActuationBanner(
                        note: .init(
                            tone: .bad,
                            icon: "antenna.radiowaves.left.and.right.slash",
                            title: "Could not reach the command centre",
                            body: message
                        )
                    )
                }

                macCard
                nowCard
                contentCard
                goalsCard
                activityCard

                WorkerDeepSections(snapshot: store.snapshot)

                footer
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background(Theme.pageBackground)
        .scrollDismissesKeyboard(.immediately)
        .refreshable { await store.refreshEverything() }
        .navigationTitle("Admin Worker")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAccount = true
                } label: {
                    Image(systemName: "person.crop.circle")
                }
                .accessibilityLabel("Session")
            }
        }
        .sheet(isPresented: $showingAccount) {
            AccountSheet(store: store)
        }
    }

    // MARK: - is the Mac there?

    private var macCard: some View {
        SectionCard(title: "The Mac", subtitle: store.status?.mac.displayLabel) {
            RowStack {
                KeyValueRow(
                    key: "Runtime",
                    value: macPresenceWord,
                    tone: macPresenceTone
                )
                if let host = store.status?.mac.hostLabel, !host.isEmpty {
                    KeyValueRow(key: "Host", value: host)
                }
                if let runState = store.status?.mac.runState {
                    KeyValueRow(
                        key: "Run state",
                        value: Formatting.humanise(runState),
                        tone: StatusTone.forWord(runState)
                    )
                }
                if let age = store.status?.mac.ageMs, store.status?.mac.presence != .absent {
                    KeyValueRow(key: "Last check-in", value: Formatting.ago(ms: age))
                }
                if let started = store.status?.mac.startedDate {
                    KeyValueRow(key: "Worker started", value: Formatting.clock(started))
                }
                KeyValueRow(
                    key: "Execution",
                    value: Formatting.humanise(store.status?.exec.stateValue),
                    tone: StatusTone.forWord(store.status?.exec.stateValue)
                )
                if let lease = store.status?.exec.lease {
                    KeyValueRow(
                        key: "Lease",
                        value: leaseWord(lease),
                        tone: (lease.live ?? false) ? .good : .caution
                    )
                }
                if let heartbeat = store.status?.runtime.heartbeatAgeMs {
                    KeyValueRow(
                        key: "Worker heartbeat",
                        value: Formatting.ago(ms: heartbeat),
                        tone: heartbeat < 10 * 60 * 1000 ? .good : .caution
                    )
                }
                if let failure = store.status?.mac.failureReason, !failure.isEmpty {
                    KeyValueRow(key: "Failure", value: failure, tone: .bad)
                }
                if store.status?.mac.isLeaseHeldElsewhere == true {
                    KeyValueRow(
                        key: "Lease held elsewhere", value: "yes", tone: .caution)
                }
                if store.status?.isDegraded == true {
                    Text(
                        "Some readings came back unknown — that is a fact about the database connection, not about the switch."
                    )
                    .font(.caption)
                    .foregroundStyle(Theme.waiting)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var macPresenceWord: String {
        switch store.status?.mac.presence {
        case .alive: return "Alive"
        case .silent: return "Not answering"
        case .absent: return "Not running"
        case .unknown, .none: return "Unknown"
        }
    }

    private var macPresenceTone: StatusTone {
        switch store.status?.mac.presence {
        case .alive: return .good
        case .silent: return .caution
        case .absent: return .neutral
        case .unknown, .none: return .unknown
        }
    }

    private func leaseWord(_ lease: LeaseView) -> String {
        let live = (lease.live ?? false) ? "live" : "stale"
        if let age = lease.ageMs {
            return "\(live), renewed \(Formatting.ago(ms: age))"
        }
        return live
    }

    // MARK: - what is it working on?

    private var nowCard: some View {
        SectionCard(title: "Right now") {
            RowStack {
                if store.status?.runtime.isPaused == true {
                    KeyValueRow(
                        key: "Paused",
                        value: store.status?.runtime.pausedReason ?? "yes",
                        tone: .caution
                    )
                }
                KeyValueRow(
                    key: "Mode",
                    value: Formatting.humanise(store.status?.runtime.mode)
                )
                KeyValueRow(
                    key: "Priority",
                    value: Formatting.humanise(store.status?.runtime.priority)
                )
                if let goal = store.status?.runtime.goal, !goal.isEmpty {
                    KeyValueRow(key: "Goal", value: goal)
                }
                if let task = store.status?.runtime.task, !task.isEmpty {
                    KeyValueRow(key: "Task", value: task)
                }
                if let blocker = store.status?.runtime.blocker, !blocker.isEmpty {
                    KeyValueRow(key: "Blocker", value: blocker, tone: .bad)
                }
                if let mission = store.snapshot?.mission,
                    let stage = mission.stage ?? mission.contentType
                {
                    KeyValueRow(key: "Mission", value: Formatting.humanise(stage))
                    if let reason = mission.reason, !reason.isEmpty {
                        Text(reason)
                            .font(.footnote)
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                if let success = store.status?.runtime.lastSuccessDate {
                    KeyValueRow(key: "Last success", value: Formatting.clock(success), tone: .good)
                }
                if let failure = store.status?.runtime.lastFailureDate {
                    KeyValueRow(key: "Last failure", value: Formatting.clock(failure), tone: .bad)
                }
                if let version = store.status?.runtime.workerVersion {
                    KeyValueRow(key: "Worker version", value: version, monospaced: true)
                }
            }
        }
    }

    // MARK: - what has it produced?

    private var contentCard: some View {
        SectionCard(
            title: "Published content",
            subtitle: store.snapshot == nil ? "Loading the command-centre snapshot…" : nil
        ) {
            VStack(alignment: .leading, spacing: 12) {
                TileGrid(items: contentTiles) { tile in
                    StatTile(value: tile.value, label: tile.label, tone: tile.tone)
                }
                if let diagnostics = store.snapshot?.diagnostics?.summary {
                    HStack(spacing: 8) {
                        Pill(text: "\(diagnostics.passCount) pass", tone: .good)
                        if diagnostics.warnCount > 0 {
                            Pill(text: "\(diagnostics.warnCount) warn", tone: .caution)
                        }
                        if diagnostics.failCount > 0 {
                            Pill(text: "\(diagnostics.failCount) fail", tone: .bad)
                        }
                    }
                }
                if let message = store.snapshotError {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(Theme.alarm)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var contentTiles: [LabelledTile] {
        let metrics = store.snapshot?.metrics ?? [:]
        func value(_ key: String) -> JSONScalar? { metrics[key] }
        var tiles: [LabelledTile] = []
        tiles.append(
            LabelledTile(
                value: value("publishedContentLive")?.display
                    ?? Formatting.integer(store.snapshot?.contentCatalogTotal),
                label: "Published live"
            ))
        tiles.append(
            LabelledTile(
                value: Formatting.integer(store.snapshot?.contentCatalogTotal),
                label: "Catalogue total"
            ))
        tiles.append(
            LabelledTile(
                value: Formatting.percent(value("publishRate30d")?.doubleValue),
                label: "Publish rate 30d"
            ))
        tiles.append(
            LabelledTile(
                value: Formatting.percent(value("qaPassRate30d")?.doubleValue),
                label: "QA pass rate 30d"
            ))
        tiles.append(
            LabelledTile(
                value: value("queueInFlight")?.display ?? "—",
                label: "Queue in flight",
                tone: (value("queueInFlight")?.doubleValue ?? 0) > 0 ? .caution : .neutral
            ))
        tiles.append(
            LabelledTile(
                value: value("reviewQueueCount")?.display ?? "—",
                label: "Awaiting review",
                tone: (value("reviewQueueCount")?.doubleValue ?? 0) > 0 ? .caution : .neutral
            ))
        return tiles
    }

    // MARK: - lanes

    private var goalsCard: some View {
        let goals = store.snapshot?.goals ?? .empty
        return SectionCard(
            title: "Content lanes",
            subtitle: goals.isEmpty ? nil : "Valid items against the target for each lane.",
            count: goals.isEmpty ? nil : goals.countLabel
        ) {
            if goals.isEmpty {
                EmptyNote(text: "No content goals in the snapshot yet.")
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(goals.rows.prefix(12)) { goal in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(Formatting.humanise(goal.contentType))
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.ink)
                                Spacer(minLength: 6)
                                Text("\(Formatting.integer(goal.have)) / \(Formatting.integer(goal.target))")
                                    .font(.caption)
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.muted)
                            }
                            GapBar(
                                fraction: goal.fraction,
                                tone: goal.gap == 0 ? .good : (goal.fraction > 0.6 ? .caution : .bad)
                            )
                            if goal.gap > 0 {
                                Text("\(Formatting.integer(goal.gap)) to go")
                                    .font(.caption)
                                    .foregroundStyle(Theme.faint)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                    if goals.rows.count > 12 {
                        EmptyNote(text: "Showing 12 of \(goals.rows.count) lanes in this payload.")
                    }
                }
            }
        }
    }

    // MARK: - recent activity

    private var activityCard: some View {
        let passes = store.snapshot?.passes ?? .empty
        let decisions = store.snapshot?.decisions ?? .empty
        return SectionCard(
            title: "Recent activity",
            count: passes.isEmpty ? nil : passes.countLabel
        ) {
            VStack(alignment: .leading, spacing: 16) {
                if passes.isEmpty && decisions.isEmpty {
                    EmptyNote(text: "No passes or decisions recorded yet.")
                }
                if !passes.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Passes")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.faint)
                        ForEach(passes.rows.prefix(6)) { pass in
                            DetailRow(
                                title: Formatting.humanise(pass.passType),
                                badge: pass.status,
                                badgeTone: StatusTone.forWord(pass.status),
                                detail:
                                    "Built \(Formatting.integer(pass.contentBuilt ?? 0)) · published \(Formatting.integer(pass.contentPublished ?? 0))",
                                trailing: pass.startedDate.map { Formatting.ago($0) }
                            )
                        }
                    }
                }
                if !decisions.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Decisions")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.faint)
                        ForEach(decisions.rows.prefix(5)) { decision in
                            DetailRow(
                                title: Formatting.humanise(decision.chosenAction),
                                badge: decision.confidence.map { Formatting.percent($0) },
                                badgeTone: .neutral,
                                detail: decision.reason,
                                trailing: decision.createdDate.map { Formatting.ago($0) }
                            )
                        }
                    }
                }
            }
        }
    }

    // MARK: - footer

    private var footer: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(freshnessLine)
            if let cache = store.snapshotCache {
                Text(
                    "Snapshot \(cache.cached == true ? "from the server cache" : "freshly read")\(cache.ageMs.map { ", \(Formatting.ago(ms: $0))" } ?? "")."
                )
            }
            Text("Trimmed for mobile by the server. The worker runs on the Mac.")
        }
        .font(.caption2)
        .foregroundStyle(Theme.faint)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }

    private var freshnessLine: String {
        guard let last = store.lastStatusAt else { return "Not yet updated." }
        if store.isOffline { return "Offline — last updated \(Formatting.ago(last))." }
        if !store.isPolling { return "Paused — last updated \(Formatting.ago(last))." }
        return "Updated \(Formatting.ago(last))."
    }
}

/// Session details and the way out.
struct AccountSheet: View {
    @ObservedObject var store: WorkerStore
    @Environment(\.dismiss) private var dismiss
    @State private var signingOut = false

    var body: some View {
        NavigationStack {
            List {
                Section("Signed in") {
                    LabeledContent("Administrator", value: SessionStore.shared.rememberedUsername)
                    LabeledContent("Site", value: "etviafidei.com")
                }
                Section("This app") {
                    LabeledContent("Role", value: "Remote control and observation")
                    Text(
                        "The Admin Worker always runs on the Mac. This app writes the durable master-switch row and reads status; it contains no worker, no ingest and no database driver."
                    )
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
                }
                if let actuation = store.status?.cadence {
                    Section("Timing") {
                        LabeledContent(
                            "Mac reconcile poll",
                            value: Formatting.duration(ms: actuation.hostPollIntervalMs) ?? "—")
                        LabeledContent(
                            "Expected actuation",
                            value: Formatting.duration(ms: actuation.expectedLatencyMs) ?? "—")
                    }
                }
                Section {
                    Button(role: .destructive) {
                        signingOut = true
                        Task {
                            await store.signOut()
                            signingOut = false
                            dismiss()
                        }
                    } label: {
                        HStack {
                            Text("Sign out")
                            if signingOut {
                                Spacer()
                                ProgressView().controlSize(.small)
                            }
                        }
                    }
                    .disabled(signingOut)
                }
            }
            .navigationTitle("Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
