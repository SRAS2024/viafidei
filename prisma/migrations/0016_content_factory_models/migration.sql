-- Content Factory v1 — new durable models that back the new
-- Planner → Queue → Worker → Content Builder → Strict QA → Persistence
-- → Public Render Gate → Monitoring pipeline.
--
-- Three new tables and one new column set:
--
--   * SourceDocument        — normalized representation of every
--                             fetched page. Builders read SourceDocument
--                             rows, never raw HTML.
--   * ContentPackageBuildLog — one row per build attempt (success or
--                             failure) so an admin can answer
--                             "why was this content not created?"
--   * SourceQualityScore    — per-source / per-content-type rolling
--                             stats used by the planner to pause bad
--                             sources and prioritise good ones.
--   * IngestionSource       — adds counters for auto-pause / prioritise.

CREATE TABLE IF NOT EXISTS "SourceDocument" (
  "id"                   TEXT NOT NULL,
  "sourceId"             TEXT,
  "adapterKey"           TEXT,
  "discoveredItemId"     TEXT,
  "workerJobId"          TEXT,
  "ingestionBatchId"     TEXT,
  "sourceUrl"            TEXT NOT NULL,
  "sourceHost"           TEXT NOT NULL,
  "sourceTier"           INTEGER,
  "sourceTitle"          TEXT,
  "cleanedBody"          TEXT,
  "rawBody"              TEXT,
  "headingsJson"         JSONB,
  "paragraphsJson"       JSONB,
  "listsJson"            JSONB,
  "tablesJson"           JSONB,
  "linksJson"            JSONB,
  "metadataJson"         JSONB,
  "sourcePurposesJson"   JSONB,
  "fetchStatus"          TEXT NOT NULL DEFAULT 'ok',
  "httpStatus"           INTEGER,
  "etag"                 TEXT,
  "lastModifiedHeader"   TEXT,
  "contentChecksum"      TEXT,
  "cleanedChecksum"      TEXT,
  "language"             TEXT,
  "fetchedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SourceDocument_sourceUrl_key" ON "SourceDocument" ("sourceUrl");
CREATE INDEX IF NOT EXISTS "SourceDocument_sourceId_fetchedAt_idx" ON "SourceDocument" ("sourceId", "fetchedAt");
CREATE INDEX IF NOT EXISTS "SourceDocument_sourceHost_fetchedAt_idx" ON "SourceDocument" ("sourceHost", "fetchedAt");
CREATE INDEX IF NOT EXISTS "SourceDocument_workerJobId_idx" ON "SourceDocument" ("workerJobId");
CREATE INDEX IF NOT EXISTS "SourceDocument_ingestionBatchId_idx" ON "SourceDocument" ("ingestionBatchId");
CREATE INDEX IF NOT EXISTS "SourceDocument_contentChecksum_idx" ON "SourceDocument" ("contentChecksum");
CREATE INDEX IF NOT EXISTS "SourceDocument_cleanedChecksum_idx" ON "SourceDocument" ("cleanedChecksum");


CREATE TABLE IF NOT EXISTS "ContentPackageBuildLog" (
  "id"                  TEXT NOT NULL,
  "sourceDocumentId"    TEXT,
  "sourceUrl"           TEXT NOT NULL,
  "sourceHost"          TEXT NOT NULL,
  "contentType"         TEXT NOT NULL,
  "builderName"         TEXT NOT NULL,
  "builderVersion"      TEXT NOT NULL,
  "buildStatus"         TEXT NOT NULL,
  "candidateSlug"       TEXT,
  "extractedFieldsJson" JSONB,
  "missingFieldsJson"   JSONB,
  "provenanceJson"      JSONB,
  "failureReason"       TEXT,
  "workerJobId"         TEXT,
  "ingestionBatchId"    TEXT,
  "contentRef"          TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContentPackageBuildLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentPackageBuildLog_sourceDocumentId_idx" ON "ContentPackageBuildLog" ("sourceDocumentId");
CREATE INDEX IF NOT EXISTS "ContentPackageBuildLog_contentType_createdAt_idx" ON "ContentPackageBuildLog" ("contentType", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentPackageBuildLog_buildStatus_createdAt_idx" ON "ContentPackageBuildLog" ("buildStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentPackageBuildLog_sourceHost_createdAt_idx" ON "ContentPackageBuildLog" ("sourceHost", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentPackageBuildLog_workerJobId_idx" ON "ContentPackageBuildLog" ("workerJobId");
CREATE INDEX IF NOT EXISTS "ContentPackageBuildLog_ingestionBatchId_idx" ON "ContentPackageBuildLog" ("ingestionBatchId");


CREATE TABLE IF NOT EXISTS "SourceQualityScore" (
  "id"                  TEXT NOT NULL,
  "sourceId"            TEXT NOT NULL,
  "contentType"         TEXT NOT NULL,
  "discoveredCount"     INTEGER NOT NULL DEFAULT 0,
  "fetchedCount"        INTEGER NOT NULL DEFAULT 0,
  "buildSuccessCount"   INTEGER NOT NULL DEFAULT 0,
  "buildFailureCount"   INTEGER NOT NULL DEFAULT 0,
  "qaPassCount"         INTEGER NOT NULL DEFAULT 0,
  "qaFailCount"         INTEGER NOT NULL DEFAULT 0,
  "deletedCount"        INTEGER NOT NULL DEFAULT 0,
  "duplicateCount"      INTEGER NOT NULL DEFAULT 0,
  "wrongContentCount"   INTEGER NOT NULL DEFAULT 0,
  "validPackageRate"    DOUBLE PRECISION,
  "wrongContentRate"    DOUBLE PRECISION,
  "averageCompleteness" DOUBLE PRECISION,
  "lastSuccessAt"       TIMESTAMP(3),
  "lastFailureAt"       TIMESTAMP(3),
  "lastFailureReason"   TEXT,
  "autoPaused"          BOOLEAN NOT NULL DEFAULT false,
  "autoPausedAt"        TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SourceQualityScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SourceQualityScore_sourceId_contentType_key" ON "SourceQualityScore" ("sourceId", "contentType");
CREATE INDEX IF NOT EXISTS "SourceQualityScore_sourceId_idx" ON "SourceQualityScore" ("sourceId");
CREATE INDEX IF NOT EXISTS "SourceQualityScore_contentType_idx" ON "SourceQualityScore" ("contentType");
CREATE INDEX IF NOT EXISTS "SourceQualityScore_autoPaused_idx" ON "SourceQualityScore" ("autoPaused");
