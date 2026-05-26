-- =============================================================================
-- 0028_admin_worker_pipeline_and_orchestrators
--
-- Spec §3 — durable pipeline records with checksum-based resume.
-- Spec §5 — CandidateUrlScorer columns + rejection patterns.
-- Spec §22 — AdminWorkerGrowthSnapshot rolling growth log.
-- Spec §23 — AdminWorkerSourceCoverage per-content-type scorecard.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AdminWorkerPipelineStage — pipelineKey, checksums, stage-specific IDs,
-- quality score
-- -----------------------------------------------------------------------------

ALTER TABLE "AdminWorkerPipelineStage"
  ADD COLUMN "pipelineKey"        TEXT,
  ADD COLUMN "candidateUrlId"     TEXT,
  ADD COLUMN "sourceReadId"       TEXT,
  ADD COLUMN "packageId"          TEXT,
  ADD COLUMN "publishedContentId" TEXT,
  ADD COLUMN "inputChecksum"      TEXT,
  ADD COLUMN "outputChecksum"     TEXT,
  ADD COLUMN "qualityScore"       DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "AdminWorkerPipelineStage_pipelineKey_idx"
  ON "AdminWorkerPipelineStage"("pipelineKey");
CREATE INDEX "AdminWorkerPipelineStage_candidateUrlId_idx"
  ON "AdminWorkerPipelineStage"("candidateUrlId");
CREATE INDEX "AdminWorkerPipelineStage_sourceReadId_idx"
  ON "AdminWorkerPipelineStage"("sourceReadId");
CREATE INDEX "AdminWorkerPipelineStage_publishedContentId_idx"
  ON "AdminWorkerPipelineStage"("publishedContentId");

-- -----------------------------------------------------------------------------
-- CandidateSourceUrl — scoring columns + rejectionPattern
-- -----------------------------------------------------------------------------

ALTER TABLE "CandidateSourceUrl"
  ADD COLUMN "rejectionPattern"               TEXT,
  ADD COLUMN "contentTypeLikelihood"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "junkRisk"                       DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "duplicateRisk"                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "sourceAuthorityScore"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "fetchPriority"                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "expectedPackageCompleteness"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "expectedValidationValue"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "scoreUpdatedAt"                 TIMESTAMP(3);

CREATE INDEX "CandidateSourceUrl_fetchPriority_idx"
  ON "CandidateSourceUrl"("fetchPriority");
CREATE INDEX "CandidateSourceUrl_status_fetchPriority_idx"
  ON "CandidateSourceUrl"("status", "fetchPriority");

-- -----------------------------------------------------------------------------
-- AdminWorkerSourceCoverage
-- -----------------------------------------------------------------------------

CREATE TABLE "AdminWorkerSourceCoverage" (
  "id"                    TEXT             PRIMARY KEY,
  "contentType"           TEXT             NOT NULL UNIQUE,
  "primarySources"        INTEGER          NOT NULL DEFAULT 0,
  "validationSources"     INTEGER          NOT NULL DEFAULT 0,
  "enrichmentSources"     INTEGER          NOT NULL DEFAULT 0,
  "recentCandidates7d"    INTEGER          NOT NULL DEFAULT 0,
  "recentValidPackages7d" INTEGER          NOT NULL DEFAULT 0,
  "recentPublishes7d"     INTEGER          NOT NULL DEFAULT 0,
  "coverageScore"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "blockedByCoverage"     BOOLEAN          NOT NULL DEFAULT FALSE,
  "blockReason"           TEXT,
  "recommendation"        TEXT,
  "updatedAt"             TIMESTAMP(3)     NOT NULL,
  "createdAt"             TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminWorkerSourceCoverage_contentType_idx"
  ON "AdminWorkerSourceCoverage"("contentType");
CREATE INDEX "AdminWorkerSourceCoverage_blockedByCoverage_idx"
  ON "AdminWorkerSourceCoverage"("blockedByCoverage");

-- -----------------------------------------------------------------------------
-- AdminWorkerGrowthSnapshot
-- -----------------------------------------------------------------------------

CREATE TABLE "AdminWorkerGrowthSnapshot" (
  "id"                   TEXT             PRIMARY KEY,
  "contentType"          TEXT             NOT NULL,
  "publishedCount"       INTEGER          NOT NULL DEFAULT 0,
  "validCount"           INTEGER          NOT NULL DEFAULT 0,
  "minimumTarget"        INTEGER          NOT NULL DEFAULT 0,
  "desiredTarget"        INTEGER          NOT NULL DEFAULT 0,
  "gap"                  INTEGER          NOT NULL DEFAULT 0,
  "growth24h"            INTEGER          NOT NULL DEFAULT 0,
  "growth7d"             INTEGER          NOT NULL DEFAULT 0,
  "growth30d"            INTEGER          NOT NULL DEFAULT 0,
  "hoursSinceLastGrowth" INTEGER,
  "qaPassRate30d"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "publishRate30d"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pipelineHealth"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"               TEXT             NOT NULL,
  "recommendation"       TEXT,
  "createdAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminWorkerGrowthSnapshot_contentType_createdAt_idx"
  ON "AdminWorkerGrowthSnapshot"("contentType", "createdAt");
CREATE INDEX "AdminWorkerGrowthSnapshot_status_idx"
  ON "AdminWorkerGrowthSnapshot"("status");
