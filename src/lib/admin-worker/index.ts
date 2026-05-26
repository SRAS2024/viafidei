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
 * Subsystems:
 *   - state machine + pause toggle           (state, modes, priorities)
 *   - brain + mission planner                (brain, mission-planner)
 *   - central pass loop                      (loop, passes, tasks)
 *   - discovery (sitemap, RSS, internal, …)  (web-navigator, *-discovery)
 *   - source reader + classifier             (source-reader, classifier)
 *   - per-content-type extractors            (extractors)
 *   - field provenance + cross-source verify (provenance, cross-source-verifier)
 *   - publishing gate + post-publish probe   (publisher, post-publish*)
 *   - homepage designer + mutator            (homepage-*)
 *   - security defender                      (security-defender, security-detectors)
 *   - durable repair plans                   (repair, repair-plans)
 *   - memory + source reputation             (memory, source-reputation)
 *   - diagnostics + readiness                (diagnostics, readiness)
 *   - PDF reports                            (report-generator, pdf)
 *
 * Internal model names (ChecklistItem, WorkerBuildJob, WorkerBuildLog)
 * deliberately keep their existing names; the spec calls for renaming
 * only the admin-facing UI.
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

export { runAdminWorkerLoop, runOnePass, type LoopOptions, type LoopResult } from "./loop";

export { executeMissionStage, type DispatchInput, type DispatchOutcome } from "./dispatcher";

export {
  runDiscoveryOrchestrator,
  discoveryCadenceMinutes,
  CONTENT_TYPE_STRATEGIES,
  type ContentTypeStrategy,
  type DiscoveryOrchestrationOutcome,
} from "./discovery-orchestrator";

export {
  scoreCandidate,
  scoreAndPersist,
  rescoreAllCandidates,
  adjustAfterOutcome,
  type CandidateScore,
} from "./candidate-scorer";

export {
  runGrowthOrchestrator,
  type GrowthAssessment,
  type GrowthOrchestrationOutcome,
  type GrowthStatus,
} from "./growth-orchestrator";

export { runSourceCoverage, listCoverageBlocked, type CoverageRow } from "./source-coverage";

export {
  runVerifier,
  listVerificationsFor,
  SENSITIVE_FIELDS,
  type VerifierOutcome,
  type VerifierPersistInput,
} from "./verifier";

export { adminWorkerFetch, type FetchedPage, type FetcherInput } from "./fetcher";

export {
  parseStructuredBlocks,
  persistStructuredBlocks,
  REJECTION_PATTERN_NAMES,
  type SourceBlockType,
  type StructuredBlock,
  type StructuredReadOutput,
} from "./structured-source-reader";

export {
  detectConfusion,
  CONFUSION_RULE_NAMES,
  type ConfusionInput,
  type ConfusionResult,
} from "./confusion-detector";

export { classifyDetailed, type DetailedClassification } from "./classifier";

export { runRepairOrchestrator, type RepairOrchestratorOutcome } from "./repair-orchestrator";

export { decayedConfidence, decayMemory, listMemoryAudit } from "./memory";

export {
  runPublishOrchestrator,
  explainPublishStatus,
  type PublishOrchestratorInput,
  type OrchestratorResult,
} from "./publish-orchestrator";

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
  fetchWithBackoff,
  reportPersistenceFailure,
  reportValidationEvidenceMissing,
  recreateMissingSourceJobs,
  type RepairKind,
  type RepairOutcome,
} from "./repair";

export { extractFeedUrls, discoverFromFeed, type RssDiscoveryOutcome } from "./rss-discovery";

export {
  BUILTIN_CONFIGURED_URLS,
  addConfiguredUrl,
  listConfiguredUrls,
  discoverFromConfiguredUrls,
  type ConfiguredUrlEntry,
  type ConfiguredUrlsOutcome,
} from "./configured-urls";

export {
  extractInternalLinks,
  discoverFromInternalLinks,
  type InternalLinkOutcome,
} from "./internal-link-discovery";

export {
  DIRECTORY_PAGES,
  discoverFromDirectories,
  type DirectoryPage,
  type DirectoryDiscoveryOutcome,
} from "./directory-discovery";

export {
  SEARCH_TEMPLATES,
  addSearchTemplate,
  listSearchTemplates,
  discoverFromSearchPages,
  type SearchTemplate,
  type SearchDiscoveryOutcome,
} from "./search-page-discovery";

export {
  registerApiAdapter,
  listApiAdapters,
  discoverFromApis,
  type ApiAdapter,
  type ApiDiscoveryOutcome,
} from "./source-apis";

export {
  computeLiturgicalContext,
  gregorianEaster,
  seasonalRelevance,
  type LiturgicalSeason,
  type LiturgicalContext,
} from "./liturgical-calendar";

export { redesignHomepage, type RedesignResult } from "./homepage-mutator";

export { loadCommandCenterMetrics, type CommandCenterMetrics } from "./metrics";

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

export { publicRouteFor, publicUrlFor, publicOrigin, type PublicRouteInfo } from "./public-routes";

export {
  verifyPublished,
  rollback,
  type VerifyPublishedInput,
  type VerifyPublishedResult,
} from "./post-publish-probe";

export {
  discoverFromHost,
  discoverFromAllAuthorities,
  type SitemapDiscoveryOutcome,
} from "./sitemap-discovery";

export {
  evaluatePublishSafety,
  type SafetyInput,
  type SafetyDecision,
  type SafetyBlockReason,
} from "./publish-safety";

export {
  validatePackagingByType,
  validatePrayerPackage,
  validateSaintPackage,
  validateApparitionPackage,
  validateDevotionPackage,
  validateNovenaPackage,
  validateRosaryPackage,
  validateConsecrationPackage,
  validateSacramentPackage,
  validateHistoryPackage,
  validateLiturgyPackage,
  validateParishPackage,
  APPROVED_HISTORY_TYPES,
  type PackagingValidationResult,
  type ApprovedHistoryType,
} from "./packaging";

export {
  detectBannedDeviceReuse,
  detectSetPublicFlagOutsideWorker,
  detectInternalRouteManipulation,
  detectSuspiciousBurst,
  detectSuccessfulBruteForceSigns,
  detectBypassAdminAuthentication,
  fireDetector,
  DETECTOR_SEVERITY,
  DETECTOR_CLASSIFICATION,
  type SecurityDetectorKind,
  type DetectorContext,
} from "./security-detectors";

// ── Brain + pipeline + repair plans + source reads + readiness ───────
export {
  runBrain,
  decide,
  rankActions,
  sampleWorld,
  type BrainAction,
  type BrainDecision,
  type BrainMissionStage,
  type WorldState,
} from "./brain";

export {
  PIPELINE_ORDER,
  nextStage,
  recordStage,
  completeStage,
  pipelineSnapshot,
  pipelineMapFor,
  latestStageFor,
  resumeOrAdvance,
  type RecordStageInput,
  type ResumeDecision,
} from "./pipeline-stages";

export {
  filePlan,
  leaseNextPlan,
  completePlan,
  countOpenPlansByKind,
  type FilePlanInput,
} from "./repair-plans";

export {
  checksumOf,
  findExistingRead,
  upsertSourceRead,
  listRecentReads,
  type UpsertSourceReadInput,
} from "./source-reads";

export {
  runReadiness,
  type ReadinessCheck,
  type ReadinessReport,
  type ReadinessStatus,
} from "./readiness";

// ── Classifier + extractors + provenance + mission planner ──────────
export {
  classify,
  toChecklistContentType,
  type ClassifierInput,
  type ClassificationResult,
  type ClassifierContentType,
} from "./classifier";

export {
  makeProvenance,
  makeInternalRuleProvenance,
  missingProvenance,
  hasFullProvenance,
  DETERMINISTIC_INTERNAL_FIELDS,
  type FieldProvenance,
  type ExtractionMethod,
} from "./provenance";

export {
  PrayerExtractor,
  SaintExtractor,
  MarianApparitionExtractor,
  DevotionExtractor,
  NovenaExtractor,
  RosaryExtractor,
  ConsecrationExtractor,
  SacramentExtractor,
  HistoryExtractor,
  LiturgyExtractor,
  ParishExtractor,
  extractByType,
  type ExtractorInput,
  type ExtractorOutput,
} from "./extractors";

export { planMission, type MissionPlan, type MissionStage } from "./mission-planner";

export {
  reportGrowth,
  escalationsForOperator,
  type GrowthReport,
  type GrowthEscalation,
} from "./content-growth";

// ── Source reader + cross-source verifier + memory hooks ────────────
export { readSource, type ReadSourceInput, type ReadSourceOutcome } from "./source-reader";

export {
  verifyCrossSource,
  type ValidationEvidence,
  type VerifyInput,
  type VerifyOutcome,
  type VerifyMatchStatus,
} from "./cross-source-verifier";

export {
  rankHostsByMemory,
  recordExtractorOutcome,
  recallExtractorMemory,
  rememberFailurePattern,
  type RankedHost,
} from "./memory";
