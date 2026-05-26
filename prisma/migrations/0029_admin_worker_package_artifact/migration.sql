-- =============================================================================
-- 0029_admin_worker_package_artifact
--
-- Spec §9 + §10. Adds AdminWorkerPackageArtifact — the durable
-- extractor output the chain advances through (extraction →
-- checklist + citation → build → verify → publish).
-- =============================================================================

CREATE TABLE "AdminWorkerPackageArtifact" (
  "id"                 TEXT             PRIMARY KEY,
  "sourceReadId"       TEXT,
  "candidateUrlId"     TEXT,
  "contentType"        TEXT             NOT NULL,
  "normalizedTitle"    TEXT             NOT NULL,
  "normalizedSlug"     TEXT             NOT NULL,
  "extractedFields"    JSONB            NOT NULL,
  "fieldProvenance"    JSONB,
  "missingFields"      TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "validationNeeds"    TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "formattingMetadata" JSONB,
  "confidenceScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "packageChecksum"    TEXT             NOT NULL,
  "status"             TEXT             NOT NULL DEFAULT 'EXTRACTED',
  "rejectionReason"    TEXT,
  "repairSuggestions"  TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "checklistItemId"    TEXT,
  "publishedContentId" TEXT,
  "createdAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)     NOT NULL
);

CREATE UNIQUE INDEX "AdminWorkerPackageArtifact_unique_idx"
  ON "AdminWorkerPackageArtifact"("contentType", "normalizedSlug", "packageChecksum");

CREATE INDEX "AdminWorkerPackageArtifact_contentType_status_idx"
  ON "AdminWorkerPackageArtifact"("contentType", "status");
CREATE INDEX "AdminWorkerPackageArtifact_candidateUrlId_idx"
  ON "AdminWorkerPackageArtifact"("candidateUrlId");
CREATE INDEX "AdminWorkerPackageArtifact_sourceReadId_idx"
  ON "AdminWorkerPackageArtifact"("sourceReadId");
CREATE INDEX "AdminWorkerPackageArtifact_checklistItemId_idx"
  ON "AdminWorkerPackageArtifact"("checklistItemId");
CREATE INDEX "AdminWorkerPackageArtifact_createdAt_idx"
  ON "AdminWorkerPackageArtifact"("createdAt");
