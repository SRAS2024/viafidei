/**
 * Strict Content QA — the single source of truth for what is allowed
 * to appear publicly in the Via Fidei catalog.
 *
 * The entry points exposed here:
 *
 *   - Per-content-type contracts (`validatePrayerPackage`, etc.) —
 *     run by the pipeline.
 *   - `runStrictPipeline` / `runStrictPipelineSync` — central
 *     orchestrator the runner + cleanup use.
 *   - `detectWrongContent` — global wrong-content detector.
 *   - `getSourcePurposes`, `isSourceApprovedFor` — source-purpose
 *     allowlist.
 *   - `recordRejectedContent` — RejectedContentLog writer.
 *   - Strict threshold counters (`getStrictBacklogCounts`, etc.).
 *   - `runStrictContentCleanup` — existing-content audit job.
 *   - `isPublicVisible`, `isCountableForThreshold` — public-page +
 *     threshold gates.
 *
 * The strict QA system replaces the loose REVIEW-by-default pipeline.
 * Every public content type owns a contract; anything that does not
 * pass its contract must not be public and must not count toward
 * thresholds.
 */

export type {
  ContentTypeKey,
  ContractDecision,
  ContractValidationResult,
  CandidatePackage,
  PackageVisibilityFlags,
} from "./types";
export { isPublicVisible, isCountableForThreshold } from "./types";

export {
  detectWrongContent,
  contentTypeMarkers,
  type WrongContentResult,
} from "./wrong-content-detector";

export {
  getSourcePurposes,
  staticPurposesForHost,
  isSourceApprovedFor,
  seedSourcePurposes,
  purposeForContentType,
  SOURCE_PURPOSES,
  type SourcePurpose,
  type SourcePurposeRecord,
} from "./source-purpose";

export {
  recordRejectedContent,
  recordRejectedContentBatch,
  summarizeRejectedContent,
  listRecentRejectedContent,
  type RejectedContentLogInput,
  type RejectedContentSummary,
} from "./rejected-log";

export {
  SACRAMENT_KEYS,
  SACRAMENT_LABELS,
  SACRAMENT_GROUPS,
  SACRAMENT_GROUP_BY_KEY,
  isCanonicalSacramentKey,
  normalizeSacrament,
  type SacramentKey,
  type SacramentGroup,
  type SacramentNormalizationResult,
} from "./sacrament-normalize";

export { runStrictPipeline, runStrictPipelineSync } from "./pipeline";

export {
  validatePrayerPackage,
  isPrayerRenderReady,
  VALID_PRAYER_TYPES,
  prayerContractMeta,
  type PrayerType,
  type PrayerPackagePayload,
} from "./contracts/prayer";

export {
  validateSaintPackage,
  isSaintRenderReady,
  VALID_SAINT_TYPES,
  saintContractMeta,
  type SaintType,
  type SaintPackagePayload,
} from "./contracts/saint";

export {
  validateApparitionPackage,
  isApparitionRenderReady,
  VALID_APPROVAL_STATUSES,
  apparitionContractMeta,
  normalizeApprovalStatus,
  type ApparitionApprovalStatus,
  type ApparitionPackagePayload,
} from "./contracts/apparition";

export {
  validateDevotionPackage,
  isDevotionRenderReady,
  VALID_DEVOTION_TYPES,
  devotionContractMeta,
  type DevotionType,
  type DevotionPackagePayload,
} from "./contracts/devotion";

export {
  validateNovenaPackage,
  isNovenaRenderReady,
  novenaContractMeta,
  type NovenaDay,
  type NovenaPackagePayload,
} from "./contracts/novena";

export {
  validateSacramentPackage,
  isSacramentRenderReady,
  sacramentContractMeta,
  type SacramentPackagePayload,
} from "./contracts/sacrament";

export {
  validateRosaryPackage,
  REQUIRED_ROSARY_PRAYERS,
  VALID_MYSTERY_SETS,
  rosaryContractMeta,
  type Mystery,
  type MysterySet,
  type RosaryPackagePayload,
} from "./contracts/rosary";

export {
  validateConsecrationPackage,
  consecrationContractMeta,
  type ConsecrationDay,
  type ConsecrationPackagePayload,
} from "./contracts/consecration";

export {
  validateSpiritualGuidancePackage,
  VALID_GUIDE_TYPES,
  spiritualGuidanceContractMeta,
  type GuideType,
  type SpiritualGuidancePackagePayload,
} from "./contracts/spiritual-guidance";

export {
  validateLiturgyPackage,
  VALID_LITURGY_KINDS,
  liturgyContractMeta,
  type LiturgyKindLabel,
  type LiturgyPackagePayload,
} from "./contracts/liturgy";

export {
  validateHistoryPackage,
  VALID_HISTORY_TYPES,
  historyContractMeta,
  type HistoryType,
  type HistoryPackagePayload,
} from "./contracts/history";

export {
  validateParishPackage,
  isParishRenderReady,
  parishContractMeta,
  type ParishPackagePayload,
} from "./contracts/parish";

export {
  validateScriptureBlock,
  validateScriptureBlocks,
  isApprovedTranslation,
  isApprovedScriptureSource,
  isApprovedLicenseStatus,
  APPROVED_BIBLE_TRANSLATIONS,
  APPROVED_SCRIPTURE_SOURCES,
  APPROVED_LICENSE_STATUSES,
  APP_BIBLE_TRANSLATION_POLICY,
  scriptureContractMeta,
  type BibleTranslation,
  type LicenseStatus,
  type ScriptureBlock,
} from "./contracts/scripture";

export {
  countStrictPrayers,
  countStrictSaints,
  countStrictParishes,
  countStrictApparitions,
  countStrictDevotions,
  countStrictNovenas,
  countStrictSacraments,
  countStrictRosary,
  countStrictConsecrations,
  countStrictSpiritualGuidance,
  countStrictLiturgy,
  countStrictHistory,
  getStrictBacklogCounts,
  getStrictLegacyCounts,
  getStrictThresholdDashboard,
  STRICT_PUBLIC_WHERE_CLAUSE,
  type StrictBacklogCounts,
  type StrictThresholdRow,
  type LegacyBacklogCounts,
} from "./thresholds";

export {
  runStrictContentCleanup,
  type StrictCleanupSummary,
  type ContentTypeCleanupSummary,
  type RunStrictContentCleanupOptions,
} from "./cleanup";

export {
  resolveCleanupPolicy,
  describeCleanupPolicy,
  type CleanupMode,
  type CleanupPolicy,
} from "./cleanup-policy";

export { getCleanupHealth, type CleanupHealthSummary } from "./cleanup-health";

export {
  getSystemHealthReport,
  type SystemHealthReport,
  type HealthScore,
  type HealthStatus,
} from "./health-scores";

export { notifyRenderGateFailure } from "./render-gate-trigger";

export {
  getExtractionStats,
  overallSuccessRate,
  overallDeletionRate,
  type ExtractionStats,
  type ExtractionOutcomeKind,
  type ExtractionFailureReason,
} from "./extraction-monitor";

export {
  checkPrayerRender,
  checkSaintRender,
  checkApparitionRender,
  checkDevotionRender,
  checkNovenaRender,
  checkSacramentRender,
  checkRosaryRender,
  checkConsecrationRender,
  checkSpiritualGuidanceRender,
  checkLiturgyRender,
  checkHistoryRender,
  checkParishRender,
  RENDER_ALLOWED,
  type PublicRenderCheck,
} from "./render-readiness";

export {
  getContentQADashboard,
  listDeletedInvalidContent,
  getContentQAReportFragment,
  type ContentQADashboardRow,
  type ContentQAReportFragment,
} from "./dashboard";
