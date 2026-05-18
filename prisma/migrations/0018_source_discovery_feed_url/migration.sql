-- Source-level discovery feed URL — drives factory-native discovery.
-- When set, the worker's source_discovery handler walks this feed
-- (sitemap.xml / RSS) and enqueues source_fetch jobs per URL,
-- bypassing the legacy adapter-side discovery entirely.
--
-- Null is the default. Existing sources without a feed URL keep
-- using the legacy adapter discovery — no behaviour change at
-- deploy time.
ALTER TABLE "IngestionSource" ADD COLUMN IF NOT EXISTS "discoveryFeedUrl" TEXT;
