-- Standalone creation of the per-content-type pause table.
--
-- ContentTypePause was first introduced inside migration
-- 0011_durable_ingestion_queue, but its CREATE TABLE block was appended
-- to that migration *after* 0011 had already been recorded as applied in
-- some environments. `prisma migrate deploy` never re-runs an
-- already-applied migration, so those databases never received the table
-- and the ingestion worker / planner — which call prisma.contentTypePause.*
-- — throw at runtime.
--
-- This migration creates the table on its own so every environment
-- converges on the same schema. It mirrors the definition in 0011 exactly
-- and uses IF NOT EXISTS, so it is a no-op on databases that already have
-- the table.

CREATE TABLE IF NOT EXISTS "ContentTypePause" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedReason" TEXT,
    "actorUsername" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentTypePause_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentTypePause_contentType_key"
  ON "ContentTypePause" ("contentType");
