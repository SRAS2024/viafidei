import Foundation

/// A collection the server trimmed for the phone. `total` is the untrimmed
/// count, so the UI can honestly say "12 of 47" instead of quietly pretending
/// 12 is all there is.
struct TrimmedList<Element: Decodable>: Decodable {
    var items: [Element]?
    var total: Int?

    var rows: [Element] { items ?? [] }
    var untrimmedTotal: Int { total ?? rows.count }
    var isEmpty: Bool { rows.isEmpty }

    /// "12 of 47" when the list was cut, "12" when it was not.
    var countLabel: String {
        untrimmedTotal > rows.count ? "\(rows.count) of \(untrimmedTotal)" : "\(rows.count)"
    }

    static var empty: TrimmedList<Element> { TrimmedList(items: [], total: 0) }
}

/// A `Record<string, number | string | boolean | null>` value.
enum JSONScalar: Decodable {
    case number(Double)
    case text(String)
    case flag(Bool)
    case none

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .none
        } else if let value = try? container.decode(Bool.self) {
            self = .flag(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .text(value)
        } else {
            self = .none
        }
    }

    var display: String {
        switch self {
        case .number(let value):
            if value == value.rounded(), abs(value) < 1e15 {
                return Formatting.integer(Int(value))
            }
            return Formatting.decimal(value)
        case .text(let value): return value
        case .flag(let value): return value ? "yes" : "no"
        case .none: return "—"
        }
    }

    var doubleValue: Double? {
        if case .number(let value) = self { return value }
        if case .text(let value) = self { return Double(value) }
        return nil
    }
}

/// `GET /api/admin/worker/snapshot`, decoded — the fields this app renders.
///
/// The server already projected the ~30-query command-centre snapshot down to
/// what a phone can show. This mirrors that projection; anything not modelled
/// here is simply skipped by the decoder rather than being an error.
struct MobileSnapshot: Decodable {
    var generatedAt: String?
    var contentCatalogTotal: Int?
    var workerLive: Bool?
    var heartbeatAgeMs: Double?
    var state: SnapshotState?
    var diagnostics: SnapshotDiagnostics?
    var metrics: [String: JSONScalar]?
    var mission: SnapshotMission?
    var goals: TrimmedList<GoalRow>?
    var funnel: TrimmedList<FunnelRow>?
    var coverage: TrimmedList<CoverageRow>?
    var growth: TrimmedList<GrowthRow>?
    var pipeline: TrimmedList<PipelineRow>?
    var artifactStatus: [String: Int]?
    var passes: TrimmedList<PassRow>?
    var decisions: TrimmedList<DecisionRow>?
    var brain: SnapshotBrain?
    var sourceReputation: TrimmedList<SourceReputationRow>?
    var sourceActivity: TrimmedList<SourceActivityRow>?
    var memory: TrimmedList<MemoryRow>?
    var knowledge: SnapshotKnowledge?
    var logs: TrimmedList<LogRow>?
    var skills: TrimmedList<SkillRow>?
    var repairPlans: TrimmedList<RepairPlanRow>?
    var reviewQueue: TrimmedList<ReviewRow>?
    var qualityScores: TrimmedList<QualityRow>?
    var strictQA: TrimmedList<StrictQARow>?
    var rollbacks: TrimmedList<RollbackRow>?
    var security: TrimmedList<SecurityRow>?
    var homepageDrafts: TrimmedList<HomepageDraftRow>?
    var publishing: TrimmedList<PublishingRow>?
    var readingsCoverage: [String: JSONScalar]?

    var generatedDate: Date? { ISO.date(generatedAt) }
}

struct SnapshotState: Decodable {
    var mode: String?
    var priority: String?
    var goal: String?
    var task: String?
    var blocker: String?
    var heartbeatAt: String?
    var lastSuccessfulAt: String?
    var paused: Bool?
}

struct SnapshotDiagnostics: Decodable {
    var summary: DiagnosticsSummary?
    var ratings: TrimmedList<DiagnosticRow>?
}

struct DiagnosticsSummary: Decodable {
    var pass: Int?
    var warn: Int?
    var fail: Int?

    var passCount: Int { pass ?? 0 }
    var warnCount: Int { warn ?? 0 }
    var failCount: Int { fail ?? 0 }
}

struct DiagnosticRow: Decodable, Identifiable {
    var label: String?
    var status: String?
    var summary: String?
    var id: String { "\(label ?? "?")-\(status ?? "?")" }
}

struct SnapshotMission: Decodable {
    var stage: String?
    var contentType: String?
    var reason: String?
}

struct GoalRow: Decodable, Identifiable {
    var contentType: String?
    var currentValidCount: Int?
    var gapCount: Int?
    var status: String?
    var id: String { contentType ?? UUID().uuidString }

    var have: Int { currentValidCount ?? 0 }
    var gap: Int { max(0, gapCount ?? 0) }
    var target: Int { have + gap }
    var fraction: Double { target > 0 ? Double(have) / Double(target) : 1 }
}

struct FunnelRow: Decodable, Identifiable {
    var contentType: String?
    var candidatesDiscovered: Int?
    var sourceReadsCreated: Int?
    var packageArtifactsCreated: Int?
    var strictQAPasses: Int?
    var publishedItems: Int?
    var id: String { contentType ?? UUID().uuidString }
}

struct CoverageRow: Decodable, Identifiable {
    var contentType: String?
    var coverageScore: Double?
    var activeSourceCount: Int?
    var recentPublishes7d: Int?
    var blockedByCoverage: Bool?
    var blockReason: String?
    var id: String { contentType ?? UUID().uuidString }
}

struct GrowthRow: Decodable, Identifiable {
    var contentType: String?
    var publishedCount: Int?
    var gap: Int?
    var growth24h: Int?
    var growth7d: Int?
    var status: String?
    var id: String { contentType ?? UUID().uuidString }
}

struct PipelineRow: Decodable, Identifiable {
    var stage: String?
    var pending: Int?
    var running: Int?
    var succeeded: Int?
    var failed: Int?
    var blocked: Int?
    var id: String { stage ?? UUID().uuidString }
}

struct PassRow: Decodable, Identifiable {
    var passType: String?
    var status: String?
    var contentBuilt: Int?
    var contentPublished: Int?
    var startedAt: String?
    var id: String { "\(passType ?? "?")-\(startedAt ?? UUID().uuidString)" }
    var startedDate: Date? { ISO.date(startedAt) }
}

struct DecisionRow: Decodable, Identifiable {
    var chosenAction: String?
    var reason: String?
    var confidence: Double?
    var createdAt: String?
    var id: String { "\(chosenAction ?? "?")-\(createdAt ?? UUID().uuidString)" }
    var createdDate: Date? { ISO.date(createdAt) }
}

struct SnapshotBrain: Decodable {
    var latestFinalBrain: String?
    var degradedEvents24h: Int?
    var selectActionCalls24h: Int?
    var rankedAlternatives: TrimmedList<AlternativeRow>?
    var reasoning: TrimmedList<ReasoningRow>?
}

struct AlternativeRow: Decodable, Identifiable {
    var action: String?
    var score: Double?
    var reason: String?
    var id: String { action ?? UUID().uuidString }
}

struct ReasoningRow: Decodable, Identifiable {
    var from: String?
    var relation: String?
    var to: String?
    var explanation: String?
    var confidence: Double?
    var id: String { "\(from ?? "?")-\(relation ?? "?")-\(to ?? "?")" }
}

struct SourceReputationRow: Decodable, Identifiable {
    var sourceHost: String?
    var reputationTier: String?
    var qaPassRate: Double?
    var publicPublishRate: Double?
    var id: String { sourceHost ?? UUID().uuidString }
}

struct SourceActivityRow: Decodable, Identifiable {
    var sourceUrl: String?
    var detectedContentType: String?
    var confidenceScore: Double?
    var createdAt: String?
    var id: String { "\(sourceUrl ?? "?")-\(createdAt ?? UUID().uuidString)" }
    var createdDate: Date? { ISO.date(createdAt) }
}

struct MemoryRow: Decodable, Identifiable {
    var memoryKey: String?
    var memoryType: String?
    var confidence: Double?
    var lastUsedAt: String?
    var id: String { memoryKey ?? UUID().uuidString }
    var lastUsedDate: Date? { ISO.date(lastUsedAt) }
}

struct SnapshotKnowledge: Decodable {
    var nodes: Int?
    var edges: Int?
    var recentNodes: TrimmedList<KnowledgeNodeRow>?
}

struct KnowledgeNodeRow: Decodable, Identifiable {
    var label: String?
    var nodeType: String?
    var entityType: String?
    var updatedAt: String?
    var id: String { "\(label ?? "?")-\(updatedAt ?? UUID().uuidString)" }
    var updatedDate: Date? { ISO.date(updatedAt) }
}

struct LogRow: Decodable, Identifiable {
    var eventName: String?
    var category: String?
    var message: String?
    var createdAt: String?
    var id: String { "\(eventName ?? "?")-\(createdAt ?? UUID().uuidString)" }
    var createdDate: Date? { ISO.date(createdAt) }
}

struct SkillRow: Decodable, Identifiable {
    var skillName: String?
    var executionStatus: String?
    var verificationStatus: String?
    var riskLevel: String?
    var createdAt: String?
    var id: String { "\(skillName ?? "?")-\(createdAt ?? UUID().uuidString)" }
}

struct RepairPlanRow: Decodable, Identifiable {
    var kind: String?
    var status: String?
    var attempts: Int?
    var maxAttempts: Int?
    var updatedAt: String?
    var id: String { "\(kind ?? "?")-\(updatedAt ?? UUID().uuidString)" }
    var updatedDate: Date? { ISO.date(updatedAt) }
}

struct ReviewRow: Decodable, Identifiable {
    var id: String?
    var contentTitle: String?
    var proposedAction: String?
    var reason: String?
    var confidence: Double?
}

struct QualityRow: Decodable, Identifiable {
    var contentType: String?
    var finalScore: Double?
    var threshold: Double?
    var passed: Bool?
    var id: String { "\(contentType ?? "?")-\(finalScore ?? 0)" }
}

struct StrictQARow: Decodable, Identifiable {
    var contentType: String?
    var finalScore: Double?
    var status: String?
    var createdAt: String?
    var id: String { "\(contentType ?? "?")-\(createdAt ?? UUID().uuidString)" }
    var createdDate: Date? { ISO.date(createdAt) }
}

struct RollbackRow: Decodable, Identifiable {
    var slug: String?
    var rollbackAction: String?
    var rollbackResult: String?
    var createdAt: String?
    var id: String { "\(slug ?? "?")-\(createdAt ?? UUID().uuidString)" }
    var createdDate: Date? { ISO.date(createdAt) }
}

struct SecurityRow: Decodable, Identifiable {
    var actionType: String?
    var severity: String?
    var createdAt: String?
    var id: String { "\(actionType ?? "?")-\(createdAt ?? UUID().uuidString)" }
    var createdDate: Date? { ISO.date(createdAt) }
}

struct HomepageDraftRow: Decodable, Identifiable {
    var id: String?
    var status: String?
    var reasonSummary: String?
    var createdAt: String?
    var createdDate: Date? { ISO.date(createdAt) }
}

struct PublishingRow: Decodable, Identifiable {
    var title: String?
    var contentType: String?
    var slug: String?
    var updatedAt: String?
    var id: String { slug ?? "\(title ?? "?")-\(updatedAt ?? UUID().uuidString)" }
    var updatedDate: Date? { ISO.date(updatedAt) }
}
