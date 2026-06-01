-- =============================================================================
-- 0025_drop_legacy_system
--
-- @idempotent-recoverable
--   Every statement below is guarded (DROP ... IF EXISTS / CREATE ... IF NOT
--   EXISTS / ALTER ... DROP COLUMN IF EXISTS), so this migration is safe to
--   re-apply regardless of how far a prior attempt got. scripts/migrate-deploy.sh
--   relies on this marker to self-heal a P3009 "failed migration" wedge, and
--   tests/db/idempotent-migrations.test.ts enforces that the marker is truthful.
--
-- Completes the transition from the legacy scraper-first ingestion +
-- legacy public-content models to the checklist-first worker + the
-- Admin Worker engine. Every public route already reads from
-- PublishedContent (the new content store), so the legacy content
-- tables can be safely dropped.
--
-- Drops ~30 legacy tables:
--   - Legacy public content (Prayer, Saint, Devotion, MarianApparition,
--     Parish, LiturgyEntry, SpiritualLifeGuide, DailyLiturgy +
--     translation siblings)
--   - 5 UserSaved* tables (consolidated into one UserSavedContent
--     keyed on (userId, contentType, slug))
--   - 9 legacy ingestion tables (IngestionSource, IngestionJob,
--     IngestionJobRun, IngestionJobQueue, IngestionCursor,
--     IngestionBatch, IngestionRateBucket, DailyIngestionCounter,
--     DiscoveredSourceItem)
--   - Legacy review/log tables (ContentReview, RejectedContentLog,
--     ContentValidationEvidence, ContentPackageBuildLog,
--     SourceQualityScore, SourceTierChange, SourceDocument,
--     QueueAuditLog, RobotsCache, ContentVersion,
--     DataManagementLog, ArchiveDeletionLog)
--
-- Creates one new table:
--   - UserSavedContent — single consolidated saved-content table
--     keyed on (userId, contentType, contentSlug) so users can save
--     any PublishedContent row uniformly. Replaces the 5 separate
--     UserSavedPrayer/Saint/Apparition/Parish/Devotion tables.
--
-- Drops dependent enums after their tables: ReviewStatus,
-- ReviewDecision, LiturgyKind, SpiritualLifeKind, IngestionRunStatus,
-- IngestionJobQueueStatus, SourceHealthState, SourceTier, SourceRole.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New table: UserSavedContent (single saved-content table)
--
-- Every statement in this migration is idempotent (CREATE ... IF NOT EXISTS /
-- DROP ... IF EXISTS) so `prisma migrate deploy` can RE-APPLY it cleanly after
-- a failed/interrupted attempt. The original 2026-05-25 run was recorded as
-- failed (P3009) — most plausibly the migrate step was interrupted, or the
-- DROPs blocked on a lock held by the still-running previous replica while
-- removing ~30 legacy tables. Postgres runs the migration in one transaction,
-- so a failed attempt rolls back to the pre-0025 schema; the IF NOT EXISTS
-- guards additionally make a re-apply safe even if any object survived. To
-- recover: `prisma migrate resolve --rolled-back 0025_drop_legacy_system`,
-- then redeploy so this migration (and 0026+) re-apply.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "UserSavedContent" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "contentType" "ChecklistContentType" NOT NULL,
  "contentSlug" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSavedContent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserSavedContent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSavedContent_userId_contentType_contentSlug_key"
  ON "UserSavedContent"("userId", "contentType", "contentSlug");
CREATE INDEX IF NOT EXISTS "UserSavedContent_userId_idx" ON "UserSavedContent"("userId");
CREATE INDEX IF NOT EXISTS "UserSavedContent_contentType_contentSlug_idx"
  ON "UserSavedContent"("contentType", "contentSlug");

-- -----------------------------------------------------------------------------
-- Drop legacy saved-content tables (foreign keys cascade from User).
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "UserSavedPrayer" CASCADE;
DROP TABLE IF EXISTS "UserSavedSaint" CASCADE;
DROP TABLE IF EXISTS "UserSavedApparition" CASCADE;
DROP TABLE IF EXISTS "UserSavedParish" CASCADE;
DROP TABLE IF EXISTS "UserSavedDevotion" CASCADE;

-- -----------------------------------------------------------------------------
-- Drop legacy review / log / version tables (no current code path uses
-- these — the Admin Worker logs replace DataManagementLog and the
-- ChecklistVersion / WorkerBuildLog stack replaces ContentVersion +
-- ContentPackageBuildLog + RejectedContentLog).
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "ContentReview" CASCADE;
DROP TABLE IF EXISTS "RejectedContentLog" CASCADE;
DROP TABLE IF EXISTS "ContentValidationEvidence" CASCADE;
DROP TABLE IF EXISTS "ContentPackageBuildLog" CASCADE;
DROP TABLE IF EXISTS "ContentVersion" CASCADE;
DROP TABLE IF EXISTS "DataManagementLog" CASCADE;
DROP TABLE IF EXISTS "ArchiveDeletionLog" CASCADE;

-- -----------------------------------------------------------------------------
-- Drop legacy source / quality / queue tables (replaced by
-- AdminWorkerSourceReputation + WorkerBuildJob + WorkerBuildLog).
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "SourceQualityScore" CASCADE;
DROP TABLE IF EXISTS "SourceTierChange" CASCADE;
DROP TABLE IF EXISTS "SourceDocument" CASCADE;
DROP TABLE IF EXISTS "QueueAuditLog" CASCADE;
DROP TABLE IF EXISTS "RobotsCache" CASCADE;

-- -----------------------------------------------------------------------------
-- Drop legacy ingestion tables (replaced by checklist-first worker +
-- Admin Worker engine).
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "DailyIngestionCounter" CASCADE;
DROP TABLE IF EXISTS "DiscoveredSourceItem" CASCADE;
DROP TABLE IF EXISTS "IngestionRateBucket" CASCADE;
DROP TABLE IF EXISTS "IngestionBatch" CASCADE;
DROP TABLE IF EXISTS "IngestionCursor" CASCADE;
DROP TABLE IF EXISTS "IngestionJobQueue" CASCADE;
DROP TABLE IF EXISTS "IngestionJobRun" CASCADE;
DROP TABLE IF EXISTS "IngestionJob" CASCADE;
DROP TABLE IF EXISTS "IngestionSource" CASCADE;

-- -----------------------------------------------------------------------------
-- Drop legacy translation tables (children of legacy content models).
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "PrayerTranslation" CASCADE;
DROP TABLE IF EXISTS "SaintTranslation" CASCADE;
DROP TABLE IF EXISTS "MarianApparitionTranslation" CASCADE;
DROP TABLE IF EXISTS "DevotionTranslation" CASCADE;
DROP TABLE IF EXISTS "LiturgyEntryTranslation" CASCADE;
DROP TABLE IF EXISTS "SpiritualLifeGuideTranslation" CASCADE;

-- -----------------------------------------------------------------------------
-- Drop legacy public content tables. Every public route already reads
-- from PublishedContent — see src/lib/data/published.ts.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "Prayer" CASCADE;
DROP TABLE IF EXISTS "Saint" CASCADE;
DROP TABLE IF EXISTS "MarianApparition" CASCADE;
DROP TABLE IF EXISTS "Parish" CASCADE;
DROP TABLE IF EXISTS "Devotion" CASCADE;
DROP TABLE IF EXISTS "LiturgyEntry" CASCADE;
DROP TABLE IF EXISTS "SpiritualLifeGuide" CASCADE;
DROP TABLE IF EXISTS "DailyLiturgy" CASCADE;

-- -----------------------------------------------------------------------------
-- Drop the legacy reviewStatus column on tables that are KEPT but
-- previously held a column of a soon-to-be-dropped enum type.
-- Postgres refuses to DROP TYPE while a live column still references
-- the type, so the column drop must precede the type drop. MediaAsset
-- is the only kept table that referenced one of the dropped enums
-- (`ReviewStatus`); all other dependent columns lived on tables that
-- were already dropped above.
-- -----------------------------------------------------------------------------
ALTER TABLE "MediaAsset" DROP COLUMN IF EXISTS "reviewStatus";

-- -----------------------------------------------------------------------------
-- Drop enums whose only users were the legacy tables above.
-- -----------------------------------------------------------------------------
DROP TYPE IF EXISTS "ReviewStatus";
DROP TYPE IF EXISTS "ReviewDecision";
DROP TYPE IF EXISTS "LiturgyKind";
DROP TYPE IF EXISTS "SpiritualLifeKind";
DROP TYPE IF EXISTS "IngestionRunStatus";
DROP TYPE IF EXISTS "IngestionJobQueueStatus";
DROP TYPE IF EXISTS "SourceHealthState";
DROP TYPE IF EXISTS "SourceTier";
DROP TYPE IF EXISTS "SourceRole";
