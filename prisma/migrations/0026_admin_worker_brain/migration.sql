-- =============================================================================
-- 0026_admin_worker_brain
--
-- Phase 8 of the Admin Worker initiative. Adds the durable substrate
-- for the explicit AdminWorkerBrain module:
--   • AdminWorkerSourceRead — durable extracted text per (sourceUrl,
--     checksum) so the brain can reuse reads across passes without
--     refetching unchanged pages.
--   • AdminWorkerPipelineStage — one row per item moving through the
--     content chain (Discovery → Read → Classify → Citation → Build →
--     QA → Publish → PostPublish). Lets the diagnostics card show
--     exactly where each item is stuck.
--   • AdminWorkerRepairPlan — durable repair plans the worker
--     executes (and retries) when a pipeline stage fails.
--
-- All three tables prefer JSONB for free-form payloads + cuid() PKs
-- so they slot into the existing AdminWorker* convention.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE "AdminWorkerPipelineStageName" AS ENUM (
  'DISCOVERY',
  'CANDIDATE',
  'FETCH',
  'READ',
  'CLASSIFY',
  'CHECKLIST_ITEM',
  'CITATION',
  'BUILD_JOB',
  'BUILD_PACKAGE',
  'VALIDATE',
  'QA',
  'PUBLISH',
  'POST_PUBLISH_VERIFY',
  'SEARCH_INDEX',
  'SITEMAP',
  'CACHE'
);

CREATE TYPE "AdminWorkerPipelineStageStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'BLOCKED',
  'SKIPPED'
);

CREATE TYPE "AdminWorkerRepairKind" AS ENUM (
  'HEARTBEAT_STALE',
  'QUEUE_STUCK',
  'SOURCE_JOBS_MISSING',
  'CANDIDATE_URLS_MISSING',
  'DISCOVERY_FAILED',
  'FETCH_FAILED',
  'READ_FAILED',
  'CLASSIFY_FAILED',
  'EXTRACT_FAILED',
  'VALIDATION_FAILED',
  'QA_MISSING_FIELDS',
  'BUILD_REPEATED_FAILURE',
  'PERSIST_FAILED',
  'PUBLIC_DISPLAY_FAILED',
  'SEARCH_VISIBILITY_FAILED',
  'SITEMAP_VISIBILITY_FAILED',
  'CACHE_FAILED',
  'VALIDATION_EVIDENCE_MISSING'
);

CREATE TYPE "AdminWorkerRepairStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'ABANDONED'
);

-- -----------------------------------------------------------------------------
-- AdminWorkerSourceRead — durable extracted text per source URL.
-- The brain reuses a read when the checksum has not changed; refetches
-- when the checksum changes.
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerSourceRead" (
  "id"                  TEXT NOT NULL,
  "sourceUrl"           TEXT NOT NULL,
  "sourceHost"          TEXT NOT NULL,
  "checksum"            TEXT NOT NULL,
  "extractedTitle"      TEXT,
  "extractedText"       TEXT,
  "extractedHeadings"   JSONB,
  "detectedContentType" TEXT,
  "confidenceScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rejectedSections"    JSONB,
  "fetchStatus"         INTEGER,
  "etag"                TEXT,
  "lastModifiedHeader"  TEXT,
  "byteSize"            INTEGER,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminWorkerSourceRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminWorkerSourceRead_sourceUrl_checksum_key"
  ON "AdminWorkerSourceRead"("sourceUrl", "checksum");
CREATE INDEX "AdminWorkerSourceRead_sourceUrl_idx" ON "AdminWorkerSourceRead"("sourceUrl");
CREATE INDEX "AdminWorkerSourceRead_sourceHost_idx" ON "AdminWorkerSourceRead"("sourceHost");
CREATE INDEX "AdminWorkerSourceRead_detectedContentType_idx"
  ON "AdminWorkerSourceRead"("detectedContentType");
CREATE INDEX "AdminWorkerSourceRead_createdAt_idx" ON "AdminWorkerSourceRead"("createdAt");

-- -----------------------------------------------------------------------------
-- AdminWorkerPipelineStage — one row per item moving through the
-- content chain. The brain consults this table to see exactly where
-- each item is stuck and what the next stage should be.
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerPipelineStage" (
  "id"                  TEXT NOT NULL,
  "stageName"           "AdminWorkerPipelineStageName" NOT NULL,
  "status"              "AdminWorkerPipelineStageStatus" NOT NULL DEFAULT 'PENDING',
  "contentType"         TEXT,
  "inputId"             TEXT,
  "outputId"            TEXT,
  "startedAt"           TIMESTAMP(3),
  "completedAt"         TIMESTAMP(3),
  "failureReason"       TEXT,
  "repairRecommendation" TEXT,
  "confidenceScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata"            JSONB,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminWorkerPipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminWorkerPipelineStage_stageName_status_idx"
  ON "AdminWorkerPipelineStage"("stageName", "status");
CREATE INDEX "AdminWorkerPipelineStage_contentType_idx" ON "AdminWorkerPipelineStage"("contentType");
CREATE INDEX "AdminWorkerPipelineStage_status_idx" ON "AdminWorkerPipelineStage"("status");
CREATE INDEX "AdminWorkerPipelineStage_createdAt_idx" ON "AdminWorkerPipelineStage"("createdAt");

-- -----------------------------------------------------------------------------
-- AdminWorkerRepairPlan — durable repair plans the worker executes
-- and retries with exponential backoff.
-- -----------------------------------------------------------------------------
CREATE TABLE "AdminWorkerRepairPlan" (
  "id"             TEXT NOT NULL,
  "kind"           "AdminWorkerRepairKind" NOT NULL,
  "failedEntity"   TEXT,
  "repairAction"   TEXT NOT NULL,
  "status"         "AdminWorkerRepairStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"    INTEGER NOT NULL DEFAULT 5,
  "lastAttemptAt"  TIMESTAMP(3),
  "nextAttemptAt"  TIMESTAMP(3),
  "finalResult"    TEXT,
  "metadata"       JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminWorkerRepairPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminWorkerRepairPlan_status_idx" ON "AdminWorkerRepairPlan"("status");
CREATE INDEX "AdminWorkerRepairPlan_kind_idx" ON "AdminWorkerRepairPlan"("kind");
CREATE INDEX "AdminWorkerRepairPlan_nextAttemptAt_idx"
  ON "AdminWorkerRepairPlan"("nextAttemptAt");
CREATE INDEX "AdminWorkerRepairPlan_createdAt_idx" ON "AdminWorkerRepairPlan"("createdAt");
