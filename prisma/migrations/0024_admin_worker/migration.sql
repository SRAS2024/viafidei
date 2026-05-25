-- =============================================================================
-- 0024_admin_worker
--
-- Phase 1 of the Admin Worker initiative. Renames the existing background
-- worker concept to "Admin Worker" in admin-facing UI (internal model
-- names — ChecklistItem, WorkerBuildJob, WorkerHeartbeat — keep their
-- existing names for code/migration compatibility, per the spec) and adds
-- the durable tables the Admin Worker engine needs to be observable,
-- autonomous, and learnable without any AI APIs.
--
-- Tables added here (15):
--   - AdminWorkerState              (singleton state machine row)
--   - AdminWorkerPass               (one row per worker pass / cycle)
--   - AdminWorkerTask               (one row per scheduled action)
--   - AdminWorkerLog                (structured admin-worker log line)
--   - AdminWorkerMemory             (key/value learning store)
--   - AdminWorkerSourceReputation   (rolling source health/reputation)
--   - AdminWorkerDecision           (every routed decision + its inputs)
--   - CandidateSourceUrl            (URLs the navigator has discovered)
--   - ContentGoal                   (min/desired targets per content type)
--   - HumanReviewQueue              (rare items needing human review)
--   - HomepageWorkerDraft           (proposed homepage edits + snapshots)
--   - AdminDeveloperReportLog       (audit trail of report generation)
--   - AdminWorkerSecurityAction     (defense actions taken by the worker)
--   - PostPublishVerification       (post-publish verification results)
--   - ContentQualityScore           (deterministic per-package score)
--   - HomepageQualityScore          (deterministic homepage score)
--
-- All new tables prefer JSONB for free-form payloads and use the same
-- HMAC-fingerprint pattern as SecurityEvent for any device/IP fields.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE "AdminWorkerMode" AS ENUM (
  'SETUP',
  'CONSTANT_FILL',
  'MAINTENANCE',
  'REPAIR',
  'HOMEPAGE',
  'DIAGNOSTICS',
  'SECURITY_DEFENSE',
  'REPORTING',
  'PAUSED'
);

CREATE TYPE "AdminWorkerPriority" AS ENUM (
  'SECURITY_THREAT',
  'WORKER_HEALTH',
  'CONTENT_GOAL',
  'SOURCE_REPAIR',
  'CONTENT_BUILD',
  'CONTENT_VALIDATION',
  'CONTENT_PUBLISH',
  'HOMEPAGE',
  'DIAGNOSTICS',
  'CLEANUP',
  'MAINTENANCE'
);

CREATE TYPE "AdminWorkerPassType" AS ENUM (
  'AUTONOMOUS',
  'DIAGNOSTICS',
  'CONTENT_GOAL',
  'HOMEPAGE',
  'SOURCE_REPAIR',
  'SECURITY',
  'REPORT',
  'CLEANUP'
);

CREATE TYPE "AdminWorkerPassStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "AdminWorkerTaskType" AS ENUM (
  'DISCOVER_SOURCE',
  'READ_SOURCE',
  'CLASSIFY_CONTENT',
  'BUILD_CONTENT',
  'FORMAT_CONTENT',
  'VALIDATE_CONTENT',
  'CROSS_SOURCE_VERIFY',
  'PUBLISH_CONTENT',
  'POST_PUBLISH_VERIFY',
  'UPDATE_HOMEPAGE',
  'SECURITY_DEFENSE',
  'CLEANUP',
  'DIAGNOSTICS',
  'REPORT',
  'REPAIR'
);

CREATE TYPE "AdminWorkerTaskStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
  'CANCELLED'
);

CREATE TYPE "AdminWorkerLogSeverity" AS ENUM (
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'CRITICAL'
);

CREATE TYPE "AdminWorkerLogCategory" AS ENUM (
  'OVERVIEW',
  'WORKER_PASS',
  'SOURCE_DISCOVERY',
  'SOURCE_READING',
  'CONTENT_CLASSIFICATION',
  'CONTENT_BUILD',
  'VALIDATION',
  'QA',
  'PUBLISHING',
  'POST_PUBLISH',
  'HOMEPAGE',
  'CLEANUP',
  'SECURITY',
  'REPORT',
  'ERROR',
  'REPAIR'
);

CREATE TYPE "AdminWorkerMemoryType" AS ENUM (
  'SOURCE_PRIORITY',
  'BUILDER_PRIORITY',
  'CONTENT_TYPE_PRIORITY',
  'VALIDATION_SOURCE_PRIORITY',
  'HOMEPAGE_SELECTION',
  'CLEANUP_AGGRESSIVENESS',
  'FAILURE_PATTERN',
  'SOURCE_RETRY_TIMING',
  'GENERIC'
);

CREATE TYPE "SourceReputationTier" AS ENUM (
  'TRUSTED',
  'GOOD',
  'NEUTRAL',
  'LIMITED',
  'POOR',
  'PAUSED'
);

CREATE TYPE "CandidateSourceUrlStatus" AS ENUM (
  'DISCOVERED',
  'PRIORITIZED',
  'FETCHED',
  'BUILT',
  'REJECTED',
  'PAUSED'
);

CREATE TYPE "CandidateSourceDiscoveryMethod" AS ENUM (
  'CONFIGURED_URL',
  'SITEMAP',
  'RSS',
  'API',
  'SEARCH_PAGE',
  'INTERNAL_LINK',
  'DIRECTORY',
  'MANUAL'
);

CREATE TYPE "ContentGoalStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'NEAR_GOAL',
  'GOAL_MET',
  'MAINTENANCE',
  'PAUSED'
);

CREATE TYPE "HumanReviewStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ESCALATED',
  'EXPIRED'
);

CREATE TYPE "HomepageWorkerDraftMode" AS ENUM (
  'AUTOMATIC_SMALL',
  'SEASONAL_REFRESH',
  'CONTENT_GAP_REPAIR',
  'ADMIN_REQUESTED',
  'FULL_REFRESH'
);

CREATE TYPE "HomepageWorkerDraftStatus" AS ENUM (
  'PROPOSED',
  'AUTO_PUBLISHED',
  'AWAITING_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "AdminDeveloperReportPeriod" AS ENUM (
  'LAST_24_HOURS',
  'LAST_7_DAYS',
  'LAST_30_DAYS'
);

CREATE TYPE "AdminDeveloperReportStatus" AS ENUM (
  'PENDING',
  'GENERATED',
  'FAILED'
);

CREATE TYPE "AdminWorkerSecurityActionType" AS ENUM (
  'OBSERVE',
  'WARN',
  'RATE_LIMIT',
  'CHALLENGE',
  'BAN_DEVICE',
  'REVOKE_SESSION',
  'ESCALATE'
);

CREATE TYPE "PostPublishVerificationResult" AS ENUM (
  'PASS',
  'WARN',
  'FAIL',
  'PENDING'
);

-- -----------------------------------------------------------------------------
-- AdminWorkerState (singleton state row)
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerState" (
  "id"                TEXT NOT NULL,
  "currentMode"       "AdminWorkerMode" NOT NULL DEFAULT 'SETUP',
  "currentPriority"   "AdminWorkerPriority" NOT NULL DEFAULT 'WORKER_HEALTH',
  "currentGoal"       TEXT,
  "currentTask"       TEXT,
  "lastHeartbeatAt"   TIMESTAMP(3),
  "lastSuccessfulAt"  TIMESTAMP(3),
  "lastFailedAt"      TIMESTAMP(3),
  "currentBlocker"    TEXT,
  "recoveryAction"    TEXT,
  "workerVersion"     TEXT NOT NULL DEFAULT 'admin-worker/0.1',
  "paused"            BOOLEAN NOT NULL DEFAULT false,
  "pausedReason"      TEXT,
  "pausedByUsername"  TEXT,
  "pausedAt"          TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminWorkerState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminWorkerState_lastHeartbeatAt_idx" ON "AdminWorkerState"("lastHeartbeatAt");
CREATE INDEX "AdminWorkerState_paused_idx" ON "AdminWorkerState"("paused");

-- -----------------------------------------------------------------------------
-- AdminWorkerPass
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerPass" (
  "id"                  TEXT NOT NULL,
  "passType"            "AdminWorkerPassType" NOT NULL,
  "status"              "AdminWorkerPassStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"         TIMESTAMP(3),
  "durationMs"          INTEGER,
  "tasksPlanned"        INTEGER NOT NULL DEFAULT 0,
  "tasksCompleted"      INTEGER NOT NULL DEFAULT 0,
  "tasksFailed"         INTEGER NOT NULL DEFAULT 0,
  "contentBuilt"        INTEGER NOT NULL DEFAULT 0,
  "contentPublished"    INTEGER NOT NULL DEFAULT 0,
  "contentRejected"     INTEGER NOT NULL DEFAULT 0,
  "homepageActions"     INTEGER NOT NULL DEFAULT 0,
  "securityActions"     INTEGER NOT NULL DEFAULT 0,
  "diagnosticsResults"  JSONB,
  "summary"             TEXT,
  "errorMessage"        TEXT,
  CONSTRAINT "AdminWorkerPass_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminWorkerPass_status_idx" ON "AdminWorkerPass"("status");
CREATE INDEX "AdminWorkerPass_passType_startedAt_idx" ON "AdminWorkerPass"("passType", "startedAt");
CREATE INDEX "AdminWorkerPass_startedAt_idx" ON "AdminWorkerPass"("startedAt");

-- -----------------------------------------------------------------------------
-- AdminWorkerTask
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerTask" (
  "id"             TEXT NOT NULL,
  "passId"         TEXT,
  "taskType"       "AdminWorkerTaskType" NOT NULL,
  "priority"       "AdminWorkerPriority" NOT NULL DEFAULT 'CONTENT_BUILD',
  "status"         "AdminWorkerTaskStatus" NOT NULL DEFAULT 'PENDING',
  "contentType"    TEXT,
  "sourceId"       TEXT,
  "sourceUrl"      TEXT,
  "relatedContentId" TEXT,
  "plannedAction"  TEXT,
  "result"         TEXT,
  "failureReason"  TEXT,
  "startedAt"      TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "metadata"       JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminWorkerTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminWorkerTask_passId_fkey"
    FOREIGN KEY ("passId") REFERENCES "AdminWorkerPass"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AdminWorkerTask_passId_idx" ON "AdminWorkerTask"("passId");
CREATE INDEX "AdminWorkerTask_status_idx" ON "AdminWorkerTask"("status");
CREATE INDEX "AdminWorkerTask_taskType_status_idx" ON "AdminWorkerTask"("taskType", "status");
CREATE INDEX "AdminWorkerTask_contentType_idx" ON "AdminWorkerTask"("contentType");

-- -----------------------------------------------------------------------------
-- AdminWorkerLog
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerLog" (
  "id"               TEXT NOT NULL,
  "passId"           TEXT,
  "taskId"           TEXT,
  "severity"         "AdminWorkerLogSeverity" NOT NULL DEFAULT 'INFO',
  "category"         "AdminWorkerLogCategory" NOT NULL DEFAULT 'OVERVIEW',
  "eventName"        TEXT NOT NULL,
  "message"          TEXT NOT NULL,
  "contentType"      TEXT,
  "sourceHost"       TEXT,
  "sourceUrl"        TEXT,
  "relatedEntityId"  TEXT,
  "safeMetadata"     JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminWorkerLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminWorkerLog_passId_fkey"
    FOREIGN KEY ("passId") REFERENCES "AdminWorkerPass"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminWorkerLog_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "AdminWorkerTask"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AdminWorkerLog_passId_idx" ON "AdminWorkerLog"("passId");
CREATE INDEX "AdminWorkerLog_taskId_idx" ON "AdminWorkerLog"("taskId");
CREATE INDEX "AdminWorkerLog_category_createdAt_idx" ON "AdminWorkerLog"("category", "createdAt");
CREATE INDEX "AdminWorkerLog_severity_createdAt_idx" ON "AdminWorkerLog"("severity", "createdAt");
CREATE INDEX "AdminWorkerLog_createdAt_idx" ON "AdminWorkerLog"("createdAt");
CREATE INDEX "AdminWorkerLog_contentType_idx" ON "AdminWorkerLog"("contentType");
CREATE INDEX "AdminWorkerLog_sourceHost_idx" ON "AdminWorkerLog"("sourceHost");

-- -----------------------------------------------------------------------------
-- AdminWorkerMemory
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerMemory" (
  "id"             TEXT NOT NULL,
  "memoryType"     "AdminWorkerMemoryType" NOT NULL DEFAULT 'GENERIC',
  "memoryKey"      TEXT NOT NULL,
  "memoryValue"    JSONB NOT NULL,
  "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "successCount"   INTEGER NOT NULL DEFAULT 0,
  "failureCount"   INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminWorkerMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminWorkerMemory_memoryType_memoryKey_key"
  ON "AdminWorkerMemory"("memoryType", "memoryKey");
CREATE INDEX "AdminWorkerMemory_memoryType_idx" ON "AdminWorkerMemory"("memoryType");
CREATE INDEX "AdminWorkerMemory_confidence_idx" ON "AdminWorkerMemory"("confidence");

-- -----------------------------------------------------------------------------
-- AdminWorkerSourceReputation
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerSourceReputation" (
  "id"                         TEXT NOT NULL,
  "sourceId"                   TEXT,
  "sourceHost"                 TEXT NOT NULL,
  "sourceRole"                 TEXT,
  "contentType"                TEXT,
  "discoverySuccessRate"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fetchSuccessRate"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contentBuildSuccessRate"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qaPassRate"                 DOUBLE PRECISION NOT NULL DEFAULT 0,
  "validationEvidenceSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "publicPublishRate"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "wrongContentRate"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duplicateRate"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageUsefulness"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reputationTier"             "SourceReputationTier" NOT NULL DEFAULT 'NEUTRAL',
  "paused"                     BOOLEAN NOT NULL DEFAULT false,
  "lastScoreUpdate"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminWorkerSourceReputation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminWorkerSourceReputation_sourceHost_contentType_key"
  ON "AdminWorkerSourceReputation"("sourceHost", "contentType");
CREATE INDEX "AdminWorkerSourceReputation_reputationTier_idx"
  ON "AdminWorkerSourceReputation"("reputationTier");
CREATE INDEX "AdminWorkerSourceReputation_paused_idx" ON "AdminWorkerSourceReputation"("paused");

-- -----------------------------------------------------------------------------
-- AdminWorkerDecision
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerDecision" (
  "id"             TEXT NOT NULL,
  "passId"         TEXT,
  "taskId"         TEXT,
  "decisionType"   TEXT NOT NULL,
  "inputSummary"   TEXT NOT NULL,
  "rulesEvaluated" JSONB,
  "chosenAction"   TEXT NOT NULL,
  "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason"         TEXT,
  "fallbackAction" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminWorkerDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminWorkerDecision_passId_fkey"
    FOREIGN KEY ("passId") REFERENCES "AdminWorkerPass"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminWorkerDecision_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "AdminWorkerTask"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AdminWorkerDecision_decisionType_idx" ON "AdminWorkerDecision"("decisionType");
CREATE INDEX "AdminWorkerDecision_createdAt_idx" ON "AdminWorkerDecision"("createdAt");
CREATE INDEX "AdminWorkerDecision_passId_idx" ON "AdminWorkerDecision"("passId");

-- -----------------------------------------------------------------------------
-- CandidateSourceUrl
-- -----------------------------------------------------------------------------
CREATE TABLE "CandidateSourceUrl" (
  "id"                   TEXT NOT NULL,
  "discoveredUrl"        TEXT NOT NULL,
  "sourceHost"           TEXT NOT NULL,
  "sourceId"             TEXT,
  "discoveryMethod"      "CandidateSourceDiscoveryMethod" NOT NULL DEFAULT 'INTERNAL_LINK',
  "predictedContentType" TEXT,
  "predictedUsefulness"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"               "CandidateSourceUrlStatus" NOT NULL DEFAULT 'DISCOVERED',
  "fetchAttempts"        INTEGER NOT NULL DEFAULT 0,
  "lastFetchedAt"        TIMESTAMP(3),
  "rejectionReason"      TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateSourceUrl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateSourceUrl_discoveredUrl_key"
  ON "CandidateSourceUrl"("discoveredUrl");
CREATE INDEX "CandidateSourceUrl_status_idx" ON "CandidateSourceUrl"("status");
CREATE INDEX "CandidateSourceUrl_sourceHost_idx" ON "CandidateSourceUrl"("sourceHost");
CREATE INDEX "CandidateSourceUrl_predictedContentType_idx"
  ON "CandidateSourceUrl"("predictedContentType");
CREATE INDEX "CandidateSourceUrl_predictedUsefulness_idx"
  ON "CandidateSourceUrl"("predictedUsefulness");

-- -----------------------------------------------------------------------------
-- ContentGoal
-- -----------------------------------------------------------------------------
CREATE TABLE "ContentGoal" (
  "id"               TEXT NOT NULL,
  "contentType"      TEXT NOT NULL,
  "minimumTarget"    INTEGER NOT NULL DEFAULT 0,
  "desiredTarget"    INTEGER NOT NULL DEFAULT 0,
  "currentValidCount" INTEGER NOT NULL DEFAULT 0,
  "gapCount"         INTEGER NOT NULL DEFAULT 0,
  "priority"         INTEGER NOT NULL DEFAULT 100,
  "status"           "ContentGoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "lastUpdatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentGoal_contentType_key" ON "ContentGoal"("contentType");
CREATE INDEX "ContentGoal_status_idx" ON "ContentGoal"("status");
CREATE INDEX "ContentGoal_priority_idx" ON "ContentGoal"("priority");

-- -----------------------------------------------------------------------------
-- HumanReviewQueue
-- -----------------------------------------------------------------------------
CREATE TABLE "HumanReviewQueue" (
  "id"             TEXT NOT NULL,
  "taskId"         TEXT,
  "contentType"    TEXT,
  "contentTitle"   TEXT,
  "proposedAction" TEXT NOT NULL,
  "reason"         TEXT NOT NULL,
  "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sourceEvidence" JSONB,
  "currentVersion" JSONB,
  "proposedVersion" JSONB,
  "status"         "HumanReviewStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"     TIMESTAMP(3),
  "reviewedByUsername" TEXT,
  "reviewerNotes"  TEXT,
  CONSTRAINT "HumanReviewQueue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HumanReviewQueue_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "AdminWorkerTask"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "HumanReviewQueue_status_idx" ON "HumanReviewQueue"("status");
CREATE INDEX "HumanReviewQueue_contentType_idx" ON "HumanReviewQueue"("contentType");
CREATE INDEX "HumanReviewQueue_createdAt_idx" ON "HumanReviewQueue"("createdAt");

-- -----------------------------------------------------------------------------
-- HomepageWorkerDraft
-- -----------------------------------------------------------------------------
CREATE TABLE "HomepageWorkerDraft" (
  "id"                   TEXT NOT NULL,
  "passId"               TEXT,
  "mode"                 "HomepageWorkerDraftMode" NOT NULL DEFAULT 'AUTOMATIC_SMALL',
  "currentSnapshot"      JSONB,
  "proposedSnapshot"     JSONB,
  "reasonSummary"        TEXT,
  "sectionsChanged"      TEXT[] DEFAULT ARRAY[]::TEXT[],
  "confidence"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"               "HomepageWorkerDraftStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt"          TIMESTAMP(3),
  CONSTRAINT "HomepageWorkerDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HomepageWorkerDraft_passId_fkey"
    FOREIGN KEY ("passId") REFERENCES "AdminWorkerPass"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "HomepageWorkerDraft_status_idx" ON "HomepageWorkerDraft"("status");
CREATE INDEX "HomepageWorkerDraft_createdAt_idx" ON "HomepageWorkerDraft"("createdAt");

-- -----------------------------------------------------------------------------
-- AdminDeveloperReportLog
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminDeveloperReportLog" (
  "id"                TEXT NOT NULL,
  "reportPeriod"      "AdminDeveloperReportPeriod" NOT NULL,
  "generatedBy"       TEXT NOT NULL,
  "generatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fileSize"          INTEGER,
  "includedSections"  TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status"            "AdminDeveloperReportStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage"      TEXT,
  CONSTRAINT "AdminDeveloperReportLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminDeveloperReportLog_generatedAt_idx" ON "AdminDeveloperReportLog"("generatedAt");
CREATE INDEX "AdminDeveloperReportLog_status_idx" ON "AdminDeveloperReportLog"("status");

-- -----------------------------------------------------------------------------
-- AdminWorkerSecurityAction
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerSecurityAction" (
  "id"               TEXT NOT NULL,
  "securityEventId"  TEXT,
  "passId"           TEXT,
  "actionType"       "AdminWorkerSecurityActionType" NOT NULL,
  "deviceFingerprintHash" TEXT,
  "ipHash"           TEXT,
  "userAgentHash"    TEXT,
  "route"            TEXT,
  "reason"           TEXT NOT NULL,
  "severity"         TEXT NOT NULL DEFAULT 'warning',
  "confidence"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actionTaken"      TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminWorkerSecurityAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminWorkerSecurityAction_passId_fkey"
    FOREIGN KEY ("passId") REFERENCES "AdminWorkerPass"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminWorkerSecurityAction_securityEventId_fkey"
    FOREIGN KEY ("securityEventId") REFERENCES "SecurityEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AdminWorkerSecurityAction_actionType_idx" ON "AdminWorkerSecurityAction"("actionType");
CREATE INDEX "AdminWorkerSecurityAction_createdAt_idx" ON "AdminWorkerSecurityAction"("createdAt");
CREATE INDEX "AdminWorkerSecurityAction_securityEventId_idx"
  ON "AdminWorkerSecurityAction"("securityEventId");

-- -----------------------------------------------------------------------------
-- PostPublishVerification
-- -----------------------------------------------------------------------------
CREATE TABLE "PostPublishVerification" (
  "id"               TEXT NOT NULL,
  "contentType"      TEXT NOT NULL,
  "contentId"        TEXT NOT NULL,
  "slug"             TEXT NOT NULL,
  "publicPageCheck"  "PostPublishVerificationResult" NOT NULL DEFAULT 'PENDING',
  "tabPlacementCheck" "PostPublishVerificationResult" NOT NULL DEFAULT 'PENDING',
  "searchCheck"      "PostPublishVerificationResult" NOT NULL DEFAULT 'PENDING',
  "sitemapCheck"     "PostPublishVerificationResult" NOT NULL DEFAULT 'PENDING',
  "cacheCheck"       "PostPublishVerificationResult" NOT NULL DEFAULT 'PENDING',
  "result"           "PostPublishVerificationResult" NOT NULL DEFAULT 'PENDING',
  "errorMessage"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostPublishVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostPublishVerification_contentType_contentId_idx"
  ON "PostPublishVerification"("contentType", "contentId");
CREATE INDEX "PostPublishVerification_result_idx" ON "PostPublishVerification"("result");
CREATE INDEX "PostPublishVerification_createdAt_idx" ON "PostPublishVerification"("createdAt");

-- -----------------------------------------------------------------------------
-- ContentQualityScore
-- -----------------------------------------------------------------------------
CREATE TABLE "ContentQualityScore" (
  "id"                  TEXT NOT NULL,
  "contentType"         TEXT NOT NULL,
  "contentId"           TEXT NOT NULL,
  "completenessScore"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "correctnessScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "formattingScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sourceEvidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "validationScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "renderScore"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalScore"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentQualityScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentQualityScore_contentType_contentId_idx"
  ON "ContentQualityScore"("contentType", "contentId");
CREATE INDEX "ContentQualityScore_finalScore_idx" ON "ContentQualityScore"("finalScore");
CREATE INDEX "ContentQualityScore_createdAt_idx" ON "ContentQualityScore"("createdAt");

-- -----------------------------------------------------------------------------
-- HomepageQualityScore
-- -----------------------------------------------------------------------------
CREATE TABLE "HomepageQualityScore" (
  "id"                       TEXT NOT NULL,
  "contentFreshnessScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sectionBalanceScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "visualCompletenessScore"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "linkHealthScore"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "seasonalRelevanceScore"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "emptyStateAvoidanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accessibilityScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mobileReadinessScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalScore"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomepageQualityScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomepageQualityScore_finalScore_idx" ON "HomepageQualityScore"("finalScore");
CREATE INDEX "HomepageQualityScore_createdAt_idx" ON "HomepageQualityScore"("createdAt");

-- -----------------------------------------------------------------------------
-- Seed the singleton AdminWorkerState row so the engine always has somewhere
-- to write its heartbeat without needing a separate bootstrap step.
-- -----------------------------------------------------------------------------
INSERT INTO "AdminWorkerState" (
  "id", "currentMode", "currentPriority", "workerVersion", "updatedAt"
) VALUES (
  'singleton', 'SETUP', 'WORKER_HEALTH', 'admin-worker/0.1', CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
