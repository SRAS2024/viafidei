-- =============================================================================
-- 0030_admin_worker_strict_qa
--
-- Spec §5 + §6 follow-up. Durable AdminWorkerStrictQAResult — one row
-- per package artifact, recording each QA dimension and the final
-- pass / fail / needs_repair status. The publish gate enforces a
-- PASSED row before approving an artifact for publish.
-- =============================================================================

CREATE TABLE "AdminWorkerStrictQAResult" (
  "id"                   TEXT             PRIMARY KEY,
  "packageArtifactId"    TEXT             NOT NULL,
  "contentType"          TEXT             NOT NULL,
  "completenessScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "correctnessScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "formattingScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "provenanceScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "validationScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duplicateSafetyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "publicReadinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalScore"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"               TEXT             NOT NULL DEFAULT 'PENDING',
  "blockingReasons"      TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "repairSuggestions"    TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AdminWorkerStrictQAResult_packageArtifactId_key"
  ON "AdminWorkerStrictQAResult"("packageArtifactId");
CREATE INDEX "AdminWorkerStrictQAResult_contentType_status_idx"
  ON "AdminWorkerStrictQAResult"("contentType", "status");
CREATE INDEX "AdminWorkerStrictQAResult_finalScore_idx"
  ON "AdminWorkerStrictQAResult"("finalScore");
CREATE INDEX "AdminWorkerStrictQAResult_createdAt_idx"
  ON "AdminWorkerStrictQAResult"("createdAt");
