import SwiftUI

/// Everything the desktop console shows that a phone should be able to reach
/// but should not have to scroll past. Each section is folded shut until the
/// operator opens it; each one says how much of the list it is showing.
struct WorkerDeepSections: View {
    let snapshot: MobileSnapshot?

    var body: some View {
        Group {
            growth
            pipeline
            funnelAndCoverage
            brain
            quality
            securityAndRepair
            sourcesAndMemory
            publishing
            log
        }
    }

    // MARK: - growth

    @ViewBuilder private var growth: some View {
        let rows = snapshot?.growth ?? .empty
        if !rows.isEmpty {
            FoldingSection(
                title: "Growth",
                subtitle: "Published items per lane, and the movement in the last day and week.",
                count: rows.countLabel
            ) {
                RowStack {
                    ForEach(rows.rows) { row in
                        DetailRow(
                            title: Formatting.humanise(row.contentType),
                            badge: row.status,
                            badgeTone: StatusTone.forWord(row.status),
                            detail:
                                "\(Formatting.integer(row.publishedCount ?? 0)) published · gap \(Formatting.integer(row.gap ?? 0))",
                            trailing:
                                "+\(Formatting.integer(row.growth24h ?? 0)) in 24h · +\(Formatting.integer(row.growth7d ?? 0)) in 7d"
                        )
                    }
                }
            }
        }
    }

    // MARK: - pipeline

    @ViewBuilder private var pipeline: some View {
        let rows = snapshot?.pipeline ?? .empty
        let artifacts = snapshot?.artifactStatus ?? [:]
        if !rows.isEmpty || !artifacts.isEmpty {
            FoldingSection(
                title: "Pipeline",
                subtitle: "Where work is sitting between discovery and publication.",
                count: rows.isEmpty ? nil : rows.countLabel
            ) {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(rows.rows) { row in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(Formatting.humanise(row.stage))
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.ink)
                            HStack(spacing: 6) {
                                if (row.running ?? 0) > 0 {
                                    Pill(text: "\(row.running ?? 0) running", tone: .caution)
                                }
                                if (row.pending ?? 0) > 0 {
                                    Pill(text: "\(row.pending ?? 0) pending", tone: .neutral)
                                }
                                if (row.succeeded ?? 0) > 0 {
                                    Pill(text: "\(row.succeeded ?? 0) ok", tone: .good)
                                }
                                if (row.failed ?? 0) > 0 {
                                    Pill(text: "\(row.failed ?? 0) failed", tone: .bad)
                                }
                                if (row.blocked ?? 0) > 0 {
                                    Pill(text: "\(row.blocked ?? 0) blocked", tone: .bad)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityElement(children: .combine)
                    }
                    if !artifacts.isEmpty {
                        Divider().overlay(Theme.hairline)
                        Text("Artifacts")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.faint)
                        TileGrid(
                            items: artifacts.sorted { $0.key < $1.key }.map {
                                LabelledTile(
                                    value: Formatting.integer($0.value),
                                    label: Formatting.humanise($0.key),
                                    tone: StatusTone.forWord($0.key)
                                )
                            }
                        ) { tile in
                            StatTile(value: tile.value, label: tile.label, tone: tile.tone)
                        }
                    }
                }
            }
        }
    }

    // MARK: - funnel and coverage

    @ViewBuilder private var funnelAndCoverage: some View {
        let funnel = snapshot?.funnel ?? .empty
        let coverage = snapshot?.coverage ?? .empty
        if !funnel.isEmpty || !coverage.isEmpty {
            FoldingSection(
                title: "Funnel and coverage",
                subtitle: "How many candidates survive each stage, and which lanes are starved of sources.",
                count: funnel.isEmpty ? coverage.countLabel : funnel.countLabel
            ) {
                VStack(alignment: .leading, spacing: 16) {
                    if !funnel.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(funnel.rows) { row in
                                DetailRow(
                                    title: Formatting.humanise(row.contentType),
                                    detail:
                                        "\(Formatting.integer(row.candidatesDiscovered ?? 0)) found → \(Formatting.integer(row.sourceReadsCreated ?? 0)) read → \(Formatting.integer(row.packageArtifactsCreated ?? 0)) packaged",
                                    trailing:
                                        "\(Formatting.integer(row.strictQAPasses ?? 0)) passed QA · \(Formatting.integer(row.publishedItems ?? 0)) published"
                                )
                            }
                        }
                    }
                    if !coverage.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Source coverage")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(coverage.rows) { row in
                                DetailRow(
                                    title: Formatting.humanise(row.contentType),
                                    badge: (row.blockedByCoverage ?? false) ? "blocked" : nil,
                                    badgeTone: .bad,
                                    detail:
                                        "Score \(Formatting.score(row.coverageScore)) · \(Formatting.integer(row.activeSourceCount ?? 0)) sources · \(Formatting.integer(row.recentPublishes7d ?? 0)) published in 7d",
                                    trailing: row.blockReason
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - the brain

    @ViewBuilder private var brain: some View {
        if let brain = snapshot?.brain {
            let alternatives = brain.rankedAlternatives ?? .empty
            let reasoning = brain.reasoning ?? .empty
            FoldingSection(
                title: "The brain",
                subtitle: "What the unified intelligence chose, and what it considered instead."
            ) {
                VStack(alignment: .leading, spacing: 14) {
                    RowStack {
                        if let final = brain.latestFinalBrain, !final.isEmpty {
                            KeyValueRow(key: "Latest decision", value: Formatting.humanise(final))
                        }
                        KeyValueRow(
                            key: "selectAction calls (24h)",
                            value: Formatting.integer(brain.selectActionCalls24h)
                        )
                        KeyValueRow(
                            key: "Degraded events (24h)",
                            value: Formatting.integer(brain.degradedEvents24h),
                            tone: (brain.degradedEvents24h ?? 0) > 0 ? .caution : .good
                        )
                    }
                    if !alternatives.isEmpty {
                        Divider().overlay(Theme.hairline)
                        Text("Ranked alternatives")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.faint)
                        ForEach(alternatives.rows) { row in
                            DetailRow(
                                title: Formatting.humanise(row.action),
                                badge: row.score.map { Formatting.score($0) },
                                detail: row.reason
                            )
                        }
                    }
                    if !reasoning.isEmpty {
                        Divider().overlay(Theme.hairline)
                        Text("Reasoning")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.faint)
                        ForEach(reasoning.rows) { row in
                            DetailRow(
                                title:
                                    "\(Formatting.humanise(row.from)) → \(Formatting.humanise(row.to))",
                                badge: row.relation.map { Formatting.humanise($0) },
                                detail: row.explanation,
                                trailing: row.confidence.map { "confidence \(Formatting.percent($0))" }
                            )
                        }
                    }
                }
            }
        }
    }

    // MARK: - quality and review

    @ViewBuilder private var quality: some View {
        let ratings = snapshot?.diagnostics?.ratings ?? .empty
        let review = snapshot?.reviewQueue ?? .empty
        let scores = snapshot?.qualityScores ?? .empty
        let strict = snapshot?.strictQA ?? .empty
        let rollbacks = snapshot?.rollbacks ?? .empty
        if !ratings.isEmpty || !review.isEmpty || !scores.isEmpty || !strict.isEmpty
            || !rollbacks.isEmpty
        {
            FoldingSection(
                title: "Quality and review",
                subtitle: "Diagnostics, strict QA, and anything waiting on a human.",
                count: review.isEmpty ? nil : "\(review.countLabel) awaiting"
            ) {
                VStack(alignment: .leading, spacing: 16) {
                    if !review.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Awaiting review")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(review.rows) { row in
                                DetailRow(
                                    title: row.contentTitle ?? "Untitled",
                                    badge: row.proposedAction.map { Formatting.humanise($0) },
                                    badgeTone: .caution,
                                    detail: row.reason,
                                    trailing: row.confidence.map {
                                        "confidence \(Formatting.percent($0))"
                                    }
                                )
                            }
                            Text(
                                "Approving items is done on the Admin Site tab — this screen observes."
                            )
                            .font(.caption)
                            .foregroundStyle(Theme.faint)
                        }
                    }
                    if !ratings.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Diagnostics")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(ratings.rows) { row in
                                DetailRow(
                                    title: row.label ?? "—",
                                    badge: row.status,
                                    badgeTone: StatusTone.forWord(row.status),
                                    detail: row.summary
                                )
                            }
                        }
                    }
                    if !strict.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Strict QA")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(strict.rows) { row in
                                DetailRow(
                                    title: Formatting.humanise(row.contentType),
                                    badge: row.status,
                                    badgeTone: StatusTone.forWord(row.status),
                                    detail: "Score \(Formatting.score(row.finalScore))",
                                    trailing: row.createdDate.map { Formatting.ago($0) }
                                )
                            }
                        }
                    }
                    if !scores.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Quality scores")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(scores.rows) { row in
                                DetailRow(
                                    title: Formatting.humanise(row.contentType),
                                    badge: (row.passed ?? false) ? "passed" : "failed",
                                    badgeTone: (row.passed ?? false) ? .good : .bad,
                                    detail:
                                        "\(Formatting.score(row.finalScore)) against a threshold of \(Formatting.score(row.threshold))"
                                )
                            }
                        }
                    }
                    if !rollbacks.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Rollbacks")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(rollbacks.rows) { row in
                                DetailRow(
                                    title: row.slug ?? "—",
                                    badge: row.rollbackResult,
                                    badgeTone: StatusTone.forWord(row.rollbackResult),
                                    detail: Formatting.humanise(row.rollbackAction),
                                    trailing: row.createdDate.map { Formatting.ago($0) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - security and repair

    @ViewBuilder private var securityAndRepair: some View {
        let security = snapshot?.security ?? .empty
        let repairs = snapshot?.repairPlans ?? .empty
        let skills = snapshot?.skills ?? .empty
        if !security.isEmpty || !repairs.isEmpty || !skills.isEmpty {
            FoldingSection(
                title: "Security, repair and skills",
                count: security.isEmpty ? nil : "\(security.countLabel) events"
            ) {
                VStack(alignment: .leading, spacing: 16) {
                    if !security.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Security actions")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(security.rows) { row in
                                DetailRow(
                                    title: Formatting.humanise(row.actionType),
                                    badge: row.severity,
                                    badgeTone: StatusTone.forWord(row.severity),
                                    trailing: row.createdDate.map { Formatting.ago($0) }
                                )
                            }
                        }
                    }
                    if !repairs.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Repair plans")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(repairs.rows) { row in
                                DetailRow(
                                    title: Formatting.humanise(row.kind),
                                    badge: row.status,
                                    badgeTone: StatusTone.forWord(row.status),
                                    detail:
                                        "Attempt \(Formatting.integer(row.attempts ?? 0)) of \(Formatting.integer(row.maxAttempts ?? 0))",
                                    trailing: row.updatedDate.map { Formatting.ago($0) }
                                )
                            }
                        }
                    }
                    if !skills.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Skills")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(skills.rows) { row in
                                DetailRow(
                                    title: Formatting.humanise(row.skillName),
                                    badge: row.executionStatus,
                                    badgeTone: StatusTone.forWord(row.executionStatus),
                                    detail:
                                        "Verification \(Formatting.humanise(row.verificationStatus)) · risk \(Formatting.humanise(row.riskLevel))"
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - sources and memory

    @ViewBuilder private var sourcesAndMemory: some View {
        let reputation = snapshot?.sourceReputation ?? .empty
        let activity = snapshot?.sourceActivity ?? .empty
        let memory = snapshot?.memory ?? .empty
        let knowledge = snapshot?.knowledge
        if !reputation.isEmpty || !activity.isEmpty || !memory.isEmpty || knowledge != nil {
            FoldingSection(title: "Sources, memory and knowledge") {
                VStack(alignment: .leading, spacing: 16) {
                    if let knowledge {
                        TileGrid(items: [
                            LabelledTile(
                                value: Formatting.integer(knowledge.nodes), label: "Knowledge nodes"
                            ),
                            LabelledTile(
                                value: Formatting.integer(knowledge.edges), label: "Edges"
                            ),
                        ]) { tile in
                            StatTile(value: tile.value, label: tile.label, tone: tile.tone)
                        }
                        let recent = knowledge.recentNodes ?? .empty
                        if !recent.isEmpty {
                            ForEach(recent.rows) { node in
                                DetailRow(
                                    title: node.label ?? "—",
                                    badge: node.nodeType.map { Formatting.humanise($0) },
                                    detail: node.entityType.map { Formatting.humanise($0) },
                                    trailing: node.updatedDate.map { Formatting.ago($0) }
                                )
                            }
                        }
                    }
                    if !reputation.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Source reputation")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(reputation.rows) { row in
                                DetailRow(
                                    title: row.sourceHost ?? "—",
                                    badge: row.reputationTier,
                                    badgeTone: StatusTone.forWord(row.reputationTier),
                                    detail:
                                        "QA \(Formatting.percent(row.qaPassRate)) · published \(Formatting.percent(row.publicPublishRate))"
                                )
                            }
                        }
                    }
                    if !activity.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recent sources")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(activity.rows) { row in
                                DetailRow(
                                    title: row.sourceUrl ?? "—",
                                    badge: row.detectedContentType.map { Formatting.humanise($0) },
                                    detail: row.confidenceScore.map {
                                        "confidence \(Formatting.percent($0))"
                                    },
                                    trailing: row.createdDate.map { Formatting.ago($0) }
                                )
                            }
                        }
                    }
                    if !memory.isEmpty {
                        Divider().overlay(Theme.hairline)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Memory")
                                .font(.caption.weight(.semibold))
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.faint)
                            ForEach(memory.rows) { row in
                                DetailRow(
                                    title: row.memoryKey ?? "—",
                                    badge: row.memoryType.map { Formatting.humanise($0) },
                                    detail: row.confidence.map {
                                        "confidence \(Formatting.percent($0))"
                                    },
                                    trailing: row.lastUsedDate.map { Formatting.ago($0) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - publishing

    @ViewBuilder private var publishing: some View {
        let rows = snapshot?.publishing ?? .empty
        let drafts = snapshot?.homepageDrafts ?? .empty
        if !rows.isEmpty || !drafts.isEmpty {
            FoldingSection(
                title: "Recently published",
                count: rows.isEmpty ? nil : rows.countLabel
            ) {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(rows.rows) { row in
                        DetailRow(
                            title: row.title ?? row.slug ?? "—",
                            badge: row.contentType.map { Formatting.humanise($0) },
                            detail: row.slug,
                            trailing: row.updatedDate.map { Formatting.ago($0) }
                        )
                    }
                    if !drafts.isEmpty {
                        Divider().overlay(Theme.hairline)
                        Text("Homepage drafts")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.faint)
                        ForEach(drafts.rows) { row in
                            DetailRow(
                                title: row.reasonSummary ?? row.id ?? "Draft",
                                badge: row.status,
                                badgeTone: StatusTone.forWord(row.status),
                                trailing: row.createdDate.map { Formatting.ago($0) }
                            )
                        }
                    }
                }
            }
        }
    }

    // MARK: - log

    @ViewBuilder private var log: some View {
        let rows = snapshot?.logs ?? .empty
        if !rows.isEmpty {
            FoldingSection(title: "Worker log", count: rows.countLabel) {
                RowStack {
                    ForEach(rows.rows) { row in
                        DetailRow(
                            title: Formatting.humanise(row.eventName),
                            badge: row.category.map { Formatting.humanise($0) },
                            badgeTone: StatusTone.forWord(row.category),
                            detail: row.message,
                            trailing: row.createdDate.map { Formatting.ago($0) }
                        )
                    }
                }
            }
        }
    }
}
