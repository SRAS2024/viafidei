-- Durable ingestion job queue, source freshness, cursors, archive cleanup
-- with archivedAt, source tiering, content version history, and dashboards.
--
-- The previous ingestion model relied on the in-process scheduler firing
-- one `runAdapter` per active IngestionJob row, which had no durability,
-- no retry budget, and no resume-from-cursor semantics. This migration
-- adds the persistent queue + cursor + freshness layer that the worker
-- process consumes.

-- ---------------------------------------------------------------------
-- Source freshness, tiering, and health columns on IngestionSource.
-- ---------------------------------------------------------------------
ALTER TABLE "IngestionSource"
  ADD COLUMN IF NOT EXISTS "tier" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "trustLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "lastContentUpdateAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastHttpStatus" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastEtag" TEXT,
  ADD COLUMN IF NOT EXISTS "lastModifiedHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "healthState" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lowQualityRatio" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pausedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "requestSpacingMs" INTEGER,
  ADD COLUMN IF NOT EXISTS "robotsRespect" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS "IngestionSource_healthState_idx"
  ON "IngestionSource" ("healthState");
CREATE INDEX IF NOT EXISTS "IngestionSource_tier_idx"
  ON "IngestionSource" ("tier");

-- ---------------------------------------------------------------------
-- IngestionJob lifecycle columns: pause/resume + per-job rate config.
-- ---------------------------------------------------------------------
ALTER TABLE "IngestionJob"
  ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pausedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "batchSizeLimit" INTEGER;

-- ---------------------------------------------------------------------
-- Durable job queue. One row per scheduled ingestion task.
-- Lifecycle: pending → running → completed / failed / skipped / retrying.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "IngestionJobQueue" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "jobId" TEXT,
    "jobName" TEXT NOT NULL,
    "contentType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "leasedBy" TEXT,
    "errorMessage" TEXT,
    "lastError" TEXT,
    "payload" JSONB,
    "triggeredBy" TEXT NOT NULL DEFAULT 'automatic',
    "actorUsername" TEXT,
    "sentToReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngestionJobQueue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IngestionJobQueue_status_priority_runAt_idx"
  ON "IngestionJobQueue" ("status", "priority", "runAt");
CREATE INDEX IF NOT EXISTS "IngestionJobQueue_sourceId_idx"
  ON "IngestionJobQueue" ("sourceId");
CREATE INDEX IF NOT EXISTS "IngestionJobQueue_status_leaseExpiresAt_idx"
  ON "IngestionJobQueue" ("status", "leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "IngestionJobQueue_jobName_status_idx"
  ON "IngestionJobQueue" ("jobName", "status");

-- ---------------------------------------------------------------------
-- Per-source cursor. Each adapter/content-type/page/feed/url tracks
-- the last successful checkpoint so a worker restart resumes there.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "IngestionCursor" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "adapterKey" TEXT NOT NULL,
    "contentType" TEXT,
    "cursorKey" TEXT NOT NULL,
    "lastPosition" TEXT,
    "lastItemSlug" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT FALSE,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngestionCursor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngestionCursor_adapterKey_cursorKey_key"
  ON "IngestionCursor" ("adapterKey", "cursorKey");
CREATE INDEX IF NOT EXISTS "IngestionCursor_sourceId_idx"
  ON "IngestionCursor" ("sourceId");

-- ---------------------------------------------------------------------
-- Batch progress (large content types: saints, parishes).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "IngestionBatch" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "adapterKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "discovered" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "deduped" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "IngestionBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IngestionBatch_contentType_startedAt_idx"
  ON "IngestionBatch" ("contentType", "startedAt");
CREATE INDEX IF NOT EXISTS "IngestionBatch_sourceId_idx"
  ON "IngestionBatch" ("sourceId");

-- ---------------------------------------------------------------------
-- Archive deletion audit. Every hard delete writes one row.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ArchiveDeletionLog" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentSlug" TEXT,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "triggeredBy" TEXT NOT NULL DEFAULT 'automatic',
    "actorUsername" TEXT,
    CONSTRAINT "ArchiveDeletionLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ArchiveDeletionLog_contentType_deletedAt_idx"
  ON "ArchiveDeletionLog" ("contentType", "deletedAt");
CREATE INDEX IF NOT EXISTS "ArchiveDeletionLog_deletedAt_idx"
  ON "ArchiveDeletionLog" ("deletedAt");

-- ---------------------------------------------------------------------
-- Content version history (theology/saints/sacraments/Church docs).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ContentVersion" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousTitle" TEXT,
    "previousBody" TEXT,
    "previousChecksum" TEXT,
    "previousStatus" TEXT,
    "previousSource" TEXT,
    "previousUpdatedAt" TIMESTAMP(3),
    "changeSummary" TEXT,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ContentVersion_entityType_entityId_createdAt_idx"
  ON "ContentVersion" ("entityType", "entityId", "createdAt");

-- ---------------------------------------------------------------------
-- archivedAt + confidence / quality columns across content tables.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'Prayer','Saint','MarianApparition','Parish','Devotion',
    'LiturgyEntry','SpiritualLifeGuide'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format(
      'ALTER TABLE %I
         ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
         ADD COLUMN IF NOT EXISTS "sourceConfidence" DOUBLE PRECISION,
         ADD COLUMN IF NOT EXISTS "formattingConfidence" DOUBLE PRECISION,
         ADD COLUMN IF NOT EXISTS "qualityScore" DOUBLE PRECISION,
         ADD COLUMN IF NOT EXISTS "theologicalReviewFlag" BOOLEAN NOT NULL DEFAULT FALSE,
         ADD COLUMN IF NOT EXISTS "sourceTier" INTEGER,
         ADD COLUMN IF NOT EXISTS "outcomeReason" TEXT', tbl);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I ("archivedAt")',
      tbl || '_archivedAt_idx', tbl);
  END LOOP;
END$$;

-- Back-fill archivedAt for rows already in ARCHIVED status so the new
-- one-month-from-archive purge math is correct on first run. We use
-- the existing updatedAt timestamp as an approximation — it is the
-- best signal we have for "when did this row become ARCHIVED".
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'Prayer','Saint','MarianApparition','Parish','Devotion',
    'LiturgyEntry','SpiritualLifeGuide'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format(
      'UPDATE %I SET "archivedAt" = "updatedAt"
         WHERE "status" = ''ARCHIVED'' AND "archivedAt" IS NULL', tbl);
  END LOOP;
END$$;

-- ---------------------------------------------------------------------
-- Per-domain rate limiting for ingestion (separate from web rate limit).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "IngestionRateBucket" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestsInWindow" INTEGER NOT NULL DEFAULT 0,
    "lastRequestAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngestionRateBucket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngestionRateBucket_domain_key"
  ON "IngestionRateBucket" ("domain");
