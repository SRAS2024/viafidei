/**
 * Admin Worker — public entry point.
 *
 * The Admin Worker is the autonomous website-administrator system.
 * It is fully coded, deterministic, durable, observable, and
 * autonomous. It operates without any AI APIs.
 *
 * Everything important the Admin Worker exposes is re-exported here.
 * Code outside `src/lib/admin-worker/` should import from this index
 * and never reach into submodules directly.
 *
 * Phase 1 ships:
 *   - state machine (modes, priorities, pause toggle)
 *   - central decision loop wrapping the existing build worker
 *   - per-source reputation engine (deterministic, EWMA-smoothed)
 *   - per-content-type goals + planner that prioritises by gap
 *   - 24-rating diagnostics surface
 *   - rule engine + decision log
 *   - confidence-gated publishing wrapper
 *   - learning memory (no AI: success/failure counts only)
 *   - human review queue (deliberately rarely used)
 *   - homepage designer / scorer
 *   - security defender that layers on top of the existing
 *     SecurityEvent / BannedDevice flow
 *   - cleanup custodian
 *   - post-publish verification
 *   - developer report data + monthly report data
 *
 * Phase 2+ ships the live HTTP plumbing (sitemap/RSS fetchers, public
 * page checks, search-index probes, cache revalidation triggers).
 *
 * Internal model names (ChecklistItem, WorkerBuildJob, WorkerBuildLog,
 * WorkerHeartbeat) deliberately keep their existing names for
 * compatibility with the long-running worker process and historical
 * data; the spec calls for renaming only the admin-facing UI.
 */

export { ADMIN_WORKER_MODES, describeMode, type ModeDescriptor } from "./modes";

export { PRIORITY_ORDER, priorityRank, comparePriority, highestPriority } from "./priorities";

export {
  getAdminWorkerState,
  setMode,
  setPriority,
  writeHeartbeat,
  recordSuccess,
  recordFailure,
  pause,
  resume,
  isPaused,
  type AdminWorkerStateSnapshot,
} from "./state";

export {
  writeAdminWorkerLog,
  listAdminWorkerLogs,
  LOG_SECTIONS,
  type AdminWorkerLogInput,
  type ListLogsOptions,
} from "./logs";

export { startPass, completePass, listRecentPasses } from "./passes";

export { createTask, startTask, completeTask, listPendingTasks } from "./tasks";

export { recordDecision, CONFIDENCE_THRESHOLDS, type RecordDecisionInput } from "./decisions";

export { rememberOutcome, recallMemory, listMemoryByType, computeConfidence } from "./memory";

export {
  REPUTATION_THRESHOLDS,
  recordSourceOutcome,
  deriveTier,
  listSourcesByTier,
  listPausedSources,
  type SourceOutcomeUpdate,
} from "./source-reputation";

export {
  DEFAULT_GOAL_SEEDS,
  seedContentGoals,
  refreshContentGoals,
  nextPriorityContentType,
  deriveStatus,
  type ContentGoalSeed,
} from "./content-goals";

export {
  runAdminWorkerLoop,
  runOnePass,
  selectPriority,
  type LoopOptions,
  type LoopResult,
} from "./loop";

export {
  isJunkUrl,
  discoverCandidate,
  nextCandidatesForFetch,
  UnapprovedHostError,
  type DiscoverCandidateInput,
} from "./web-navigator";

export {
  fileHumanReview,
  listPendingReview,
  resolveReview,
  countPendingReview,
  type FileHumanReviewInput,
} from "./human-review";

export { computeFinalScore, recordQualityScore, type QualityInputs } from "./quality";

export {
  aggregateResult,
  recordVerification,
  rollbackPlan,
  type VerificationChecks,
} from "./post-publish";

export {
  HOMEPAGE_REDESIGN_THRESHOLD,
  computeHomepageFinalScore,
  recordHomepageScore,
  decideDraftStatus,
  createHomepageDraft,
  type HomepageScoreInputs,
  type CreateDraftInput,
} from "./homepage-designer";

export {
  DEFENDER_RULES,
  decideAction,
  defend,
  listRecentSecurityActions,
  type DefendInput,
  type DefendOutcome,
} from "./security-defender";

export {
  runAdminWorkerDiagnostics,
  summarizeRatings,
  type HealthRating,
  type HealthStatus,
} from "./diagnostics";

export { registerRule, listRules, type Rule, type RuleCategory } from "./rules";

export {
  learnFromBuild,
  learnFromPublish,
  type LearnFromBuildInput,
  type LearnFromPublishInput,
} from "./learning";

export {
  redactSecrets,
  periodToSince,
  collectDeveloperAuditData,
  DEVELOPER_AUDIT_SECTIONS,
  buildMonthlySummary,
  lastDayOfMonth,
  isLastDayOfMonth,
  type DeveloperAuditData,
  type DeveloperAuditSection,
  type MonthlySummary,
} from "./report-generator";

export {
  recoverStuckQueue,
  pauseChronicallyFailingSource,
  checkHeartbeatHealth,
  reportDiscoveryGap,
  rotateSourceForMissingFields,
  flagCacheRefresh,
  flagSitemapRefresh,
  flagSearchRefresh,
  type RepairKind,
  type RepairOutcome,
} from "./repair";

export { planAndEnqueue, type PlanOutcome } from "./planner";

export {
  evaluateDeletion,
  applyDeletion,
  DELETION_REASONS,
  type DeletionInput,
  type DeletionDecision,
  type DeletionReason,
} from "./deletion";

export { rankSource, rankedSourcePlan, type RankedSource } from "./source-strategy";

export { runMonthlyReportJobIfDue, type MonthlyReportRunOutcome } from "./monthly-report-job";

export { generateAdminWorkerDeveloperAuditPdf, generateMonthlyAdminWorkerReportPdf } from "./pdf";

export { checkWorkerHealth, type WorkerHealthSnapshot } from "./health";

export { runCleanupPass, type CleanupOutcome } from "./cleanup";

export {
  evaluatePublishGate,
  gatePublish,
  type PublishGateInput,
  type PublishGateDecision,
} from "./publisher";
