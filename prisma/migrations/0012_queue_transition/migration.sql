-- Queue-first transition migration. Adds dedupeKey/cancel/jobKind to the
-- queue, worker heartbeat, discovery items, robots cache, source coverage,
-- queue audit, source tier audit, and the per-source/per-content-type
-- daily limit tables. None of the new tables are required by the existing
-- code paths; the planner + worker activate them as the rollout proceeds.

-- ---------------------------------------------------------------------
-- IngestionJobQueue: dedupe key, job kind, cancellation, retention tag.
-- ---------------------------------------------------------------------
ALTER TABLE "IngestionJobQueue"
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "jobKind" TEXT NOT NULL DEFAULT 'source_ingest',
  ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelReason" TEXT,
  ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;

CREATE INDEX IF NOT EXISTS "IngestionJobQueue_dedupeKey_idx"
  ON "IngestionJobQueue" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "IngestionJobQueue_jobKind_status_idx"
  ON "IngestionJobQueue" ("jobKind", "status");

-- Partial unique index: only one active (pending/running/retrying) row
-- per dedupeKey can exist at once. Completed / failed / skipped rows
-- keep their historical state.
CREATE UNIQUE INDEX IF NOT EXISTS "IngestionJobQueue_active_dedupeKey_key"
  ON "IngestionJobQueue" ("dedupeKey")
  WHERE "status" IN ('pending', 'running', 'retrying') AND "dedupeKey" IS NOT NULL;

-- ---------------------------------------------------------------------
-- IngestionSource: coverage tracking + auto-pause counters + exhaustion.
-- ---------------------------------------------------------------------
ALTER TABLE "IngestionSource"
  ADD COLUMN IF NOT EXISTS "estimatedTotalItems" INTEGER,
  ADD COLUMN IF NOT EXISTS "discoveredItems" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completedItems" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rejectedItems" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "exhaustedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoPaused" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "autoPausedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSourceTierChangeAt" TIMESTAMP(3);

-- IngestionCursor: per-cursor exhaustion flag is on the existing `completed`
-- column; we add `exhaustedAt` for the timestamp + last freshness check.
ALTER TABLE "IngestionCursor"
  ADD COLUMN IF NOT EXISTS "exhaustedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFreshnessCheckAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------
-- Worker heartbeat table.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "WorkerHeartbeat" (
    "workerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "currentJobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "hostname" TEXT,
    "version" TEXT,
    "metadata" JSONB,
    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("workerId")
);
CREATE INDEX IF NOT EXISTS "WorkerHeartbeat_lastHeartbeatAt_idx"
  ON "WorkerHeartbeat" ("lastHeartbeatAt");
CREATE INDEX IF NOT EXISTS "WorkerHeartbeat_status_idx"
  ON "WorkerHeartbeat" ("status");

-- ---------------------------------------------------------------------
-- Discovered source items (URLs / feed entries / API records) — distinct
-- from queue jobs. Discovery jobs populate this; processing jobs consume
-- pending rows.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DiscoveredSourceItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "contentType" TEXT,
    "externalKey" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "processedAt" TIMESTAMP(3),
    "contentRef" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoveredSourceItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DiscoveredSourceItem_sourceId_externalKey_key"
  ON "DiscoveredSourceItem" ("sourceId", "externalKey");
CREATE INDEX IF NOT EXISTS "DiscoveredSourceItem_status_idx"
  ON "DiscoveredSourceItem" ("status");
CREATE INDEX IF NOT EXISTS "DiscoveredSourceItem_sourceId_status_idx"
  ON "DiscoveredSourceItem" ("sourceId", "status");

-- ---------------------------------------------------------------------
-- robots.txt cache.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "RobotsCache" (
    "domain" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT,
    "lastStatus" INTEGER,
    CONSTRAINT "RobotsCache_pkey" PRIMARY KEY ("domain")
);
CREATE INDEX IF NOT EXISTS "RobotsCache_expiresAt_idx"
  ON "RobotsCache" ("expiresAt");

-- ---------------------------------------------------------------------
-- Queue audit events. One row per queue lifecycle transition so the
-- admin gets a forensic history per row.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "QueueAuditLog" (
    "id" TEXT NOT NULL,
    "jobQueueId" TEXT,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorUsername" TEXT,
    "workerId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "QueueAuditLog_jobQueueId_createdAt_idx"
  ON "QueueAuditLog" ("jobQueueId", "createdAt");
CREATE INDEX IF NOT EXISTS "QueueAuditLog_event_createdAt_idx"
  ON "QueueAuditLog" ("event", "createdAt");

-- ---------------------------------------------------------------------
-- Source tier change audit.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SourceTierChange" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "previousTier" INTEGER,
    "newTier" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceTierChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SourceTierChange_sourceId_createdAt_idx"
  ON "SourceTierChange" ("sourceId", "createdAt");

-- ---------------------------------------------------------------------
-- Per-source / per-content-type daily ingestion counters.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DailyIngestionCounter" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "sourceId" TEXT,
    "contentType" TEXT,
    "enqueued" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyIngestionCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DailyIngestionCounter_day_sourceId_contentType_key"
  ON "DailyIngestionCounter" ("day", "sourceId", "contentType");
CREATE INDEX IF NOT EXISTS "DailyIngestionCounter_day_idx"
  ON "DailyIngestionCounter" ("day");
