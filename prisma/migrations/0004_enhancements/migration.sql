-- AlterTable: Prayer – add officialPrayer, externalSourceKey, sourceHost
ALTER TABLE "Prayer" ADD COLUMN "officialPrayer" TEXT;
ALTER TABLE "Prayer" ADD COLUMN "externalSourceKey" TEXT;
ALTER TABLE "Prayer" ADD COLUMN "sourceHost" TEXT;

-- CreateIndex: unique externalSourceKey on Prayer
CREATE UNIQUE INDEX "Prayer_externalSourceKey_key" ON "Prayer"("externalSourceKey");

-- CreateIndex: slug index on Prayer (already unique, add explicit index for fast lookup)
CREATE INDEX "Prayer_slug_idx" ON "Prayer"("slug");

-- AlterTable: IngestionJobRun – add recordsFailed, recordsReviewRequired
ALTER TABLE "IngestionJobRun" ADD COLUMN "recordsFailed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IngestionJobRun" ADD COLUMN "recordsReviewRequired" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: status+startedAt for ingestion dashboard queries
CREATE INDEX "IngestionJobRun_status_startedAt_idx" ON "IngestionJobRun"("status", "startedAt");

-- Full-text search indexes using GIN (PostgreSQL native full-text)
-- Prayer full-text
CREATE INDEX "Prayer_fts_idx" ON "Prayer" USING GIN (
  to_tsvector('english',
    coalesce("defaultTitle", '') || ' ' || coalesce("body", '')
  )
);

-- Saint full-text
CREATE INDEX "Saint_fts_idx" ON "Saint" USING GIN (
  to_tsvector('english',
    coalesce("canonicalName", '') || ' ' || coalesce("biography", '')
  )
);

-- MarianApparition full-text
CREATE INDEX "MarianApparition_fts_idx" ON "MarianApparition" USING GIN (
  to_tsvector('english',
    coalesce("title", '') || ' ' || coalesce("summary", '')
  )
);

-- Devotion full-text
CREATE INDEX "Devotion_fts_idx" ON "Devotion" USING GIN (
  to_tsvector('english',
    coalesce("title", '') || ' ' || coalesce("summary", '')
  )
);

-- LiturgyEntry full-text
CREATE INDEX "LiturgyEntry_fts_idx" ON "LiturgyEntry" USING GIN (
  to_tsvector('english',
    coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("body", '')
  )
);

-- SpiritualLifeGuide full-text
CREATE INDEX "SpiritualLifeGuide_fts_idx" ON "SpiritualLifeGuide" USING GIN (
  to_tsvector('english',
    coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("bodyText", '')
  )
);

-- Parish indexes for geo search
CREATE INDEX "Parish_country_city_idx" ON "Parish"("country", "city");
CREATE INDEX "Parish_geo_idx" ON "Parish"("latitude", "longitude");

-- Additional performance indexes
CREATE INDEX "Saint_feastDay_idx" ON "Saint"("feastDay");
CREATE INDEX "MarianApparition_country_idx" ON "MarianApparition"("country");
CREATE INDEX "DailyLiturgy_season_idx" ON "DailyLiturgy"("season");
CREATE INDEX "MediaAsset_reviewStatus_idx" ON "MediaAsset"("reviewStatus");
CREATE INDEX "EntityMediaLink_isPrimary_idx" ON "EntityMediaLink"("entityType", "entityId", "isPrimary");

-- Slug indexes for translation locale lookups
CREATE INDEX "PrayerTranslation_locale_idx" ON "PrayerTranslation"("locale");
CREATE INDEX "SaintTranslation_locale_idx" ON "SaintTranslation"("locale");
CREATE INDEX "MarianApparitionTranslation_locale_idx" ON "MarianApparitionTranslation"("locale");
CREATE INDEX "DevotionTranslation_locale_idx" ON "DevotionTranslation"("locale");
CREATE INDEX "LiturgyEntryTranslation_locale_idx" ON "LiturgyEntryTranslation"("locale");
CREATE INDEX "SpiritualLifeGuideTranslation_locale_idx" ON "SpiritualLifeGuideTranslation"("locale");
