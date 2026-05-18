-- Source discovery method — the typed enum the worker uses to
-- decide HOW to discover URLs from a source.
--
-- Valid values:
--   sitemap         — walk a sitemap.xml or sitemap index
--   rss             — walk an RSS / Atom feed
--   fixed_url_list  — fixed list of URLs configured on the source
--   official_api    — source provides an official API
--   factory_handler — bespoke factory-native handler keyed by handler key
--   not_configured  — source cannot be discovered automatically;
--                     the worker MUST NOT enqueue jobs for it
--
-- The column is nullable so existing rows are interpreted as
-- "method derivable from discoveryFeedUrl" until the setup task
-- backfills explicit values. The startup setup task (see
-- src/lib/startup/factory-source-setup.ts) marks every active
-- source as `sitemap` when a discoveryFeedUrl is set and
-- `not_configured` otherwise.
ALTER TABLE "IngestionSource" ADD COLUMN IF NOT EXISTS "discoveryMethod" TEXT;

-- A configuration status string for the admin source configuration
-- card. Mirrors the discovery method but adds a short human-readable
-- reason when the source is not configured.
ALTER TABLE "IngestionSource" ADD COLUMN IF NOT EXISTS "configurationStatus" TEXT;
ALTER TABLE "IngestionSource" ADD COLUMN IF NOT EXISTS "configurationStatusReason" TEXT;

-- Fetch / build / daily caps the admin source configuration card
-- exposes. Nullable; default behaviour is "use the global config".
ALTER TABLE "IngestionSource" ADD COLUMN IF NOT EXISTS "fetchLimitPerRun" INTEGER;
ALTER TABLE "IngestionSource" ADD COLUMN IF NOT EXISTS "buildLimitPerRun" INTEGER;
ALTER TABLE "IngestionSource" ADD COLUMN IF NOT EXISTS "dailyCap" INTEGER;
