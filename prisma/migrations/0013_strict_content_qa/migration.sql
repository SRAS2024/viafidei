-- Strict Content QA migration. Adds the package-validation columns used
-- by the strict content QA pipeline, the source-purpose allowlist
-- columns on IngestionSource, the RejectedContentLog audit table for
-- every deletion / rejection, and the structural columns needed to
-- store typed packages (Sacrament, Novena, History, Devotion subtype,
-- Liturgy history kind).
--
-- Public visibility on every catalog row is gated on:
--   - status            = 'PUBLISHED'
--   - publicRenderReady = true
--   - isThresholdEligible = true
--
-- A row that fails any of those gates is invisible to public tabs,
-- search, and threshold counters. The package contract system
-- (`src/lib/content-qa/contracts/*`) is the authoritative arbiter
-- of those flags.

-- ---------------------------------------------------------------------
-- Prayer: package validation columns + structured prayer type.
-- ---------------------------------------------------------------------
ALTER TABLE "Prayer"
  ADD COLUMN IF NOT EXISTS "prayerType" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "contentPackageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRenderReady" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isThresholdEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastPackageValidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Prayer_publicRenderReady_idx" ON "Prayer" ("publicRenderReady");
CREATE INDEX IF NOT EXISTS "Prayer_isThresholdEligible_idx" ON "Prayer" ("isThresholdEligible");

-- ---------------------------------------------------------------------
-- Saint: package validation columns + saintType (Saint/Blessed/Doctor/etc).
-- ---------------------------------------------------------------------
ALTER TABLE "Saint"
  ADD COLUMN IF NOT EXISTS "saintType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceHost" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "contentPackageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRenderReady" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isThresholdEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastPackageValidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Saint_publicRenderReady_idx" ON "Saint" ("publicRenderReady");
CREATE INDEX IF NOT EXISTS "Saint_isThresholdEligible_idx" ON "Saint" ("isThresholdEligible");

-- ---------------------------------------------------------------------
-- MarianApparition: package validation columns + sourceUrl/Host.
-- ---------------------------------------------------------------------
ALTER TABLE "MarianApparition"
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceHost" TEXT,
  ADD COLUMN IF NOT EXISTS "background" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "contentPackageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRenderReady" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isThresholdEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastPackageValidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MarianApparition_publicRenderReady_idx" ON "MarianApparition" ("publicRenderReady");
CREATE INDEX IF NOT EXISTS "MarianApparition_isThresholdEligible_idx" ON "MarianApparition" ("isThresholdEligible");

-- ---------------------------------------------------------------------
-- Devotion: package validation columns + structured devotion type +
-- practice instructions + subtype (Rosary / Novena / Consecration / ...)
-- + packageMetadata (Novena days, mystery sets, etc).
-- ---------------------------------------------------------------------
ALTER TABLE "Devotion"
  ADD COLUMN IF NOT EXISTS "devotionType" TEXT,
  ADD COLUMN IF NOT EXISTS "subtype" TEXT,
  ADD COLUMN IF NOT EXISTS "background" TEXT,
  ADD COLUMN IF NOT EXISTS "practiceInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "packageMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceHost" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "contentPackageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRenderReady" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isThresholdEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastPackageValidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Devotion_publicRenderReady_idx" ON "Devotion" ("publicRenderReady");
CREATE INDEX IF NOT EXISTS "Devotion_isThresholdEligible_idx" ON "Devotion" ("isThresholdEligible");
CREATE INDEX IF NOT EXISTS "Devotion_subtype_idx" ON "Devotion" ("subtype");

-- ---------------------------------------------------------------------
-- LiturgyEntry: history type + dateOrEra + packageMetadata, plus the
-- package validation columns. History items still live in LiturgyEntry
-- but are distinguished by historyType != null so HistoryPackage can
-- gate on the strict allowlist.
-- ---------------------------------------------------------------------
ALTER TABLE "LiturgyEntry"
  ADD COLUMN IF NOT EXISTS "historyType" TEXT,
  ADD COLUMN IF NOT EXISTS "dateOrEra" TEXT,
  ADD COLUMN IF NOT EXISTS "packageMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceHost" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "contentPackageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRenderReady" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isThresholdEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastPackageValidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LiturgyEntry_publicRenderReady_idx" ON "LiturgyEntry" ("publicRenderReady");
CREATE INDEX IF NOT EXISTS "LiturgyEntry_isThresholdEligible_idx" ON "LiturgyEntry" ("isThresholdEligible");
CREATE INDEX IF NOT EXISTS "LiturgyEntry_historyType_idx" ON "LiturgyEntry" ("historyType");

-- ---------------------------------------------------------------------
-- SpiritualLifeGuide: sacrament key + group + subtype + packageMetadata,
-- plus the package validation columns. Sacraments live here keyed by
-- sacramentKey (one of baptism / eucharist / confirmation /
-- reconciliation / anointing_of_the_sick / holy_orders / matrimony).
-- ---------------------------------------------------------------------
ALTER TABLE "SpiritualLifeGuide"
  ADD COLUMN IF NOT EXISTS "sacramentKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sacramentGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "subtype" TEXT,
  ADD COLUMN IF NOT EXISTS "background" TEXT,
  ADD COLUMN IF NOT EXISTS "packageMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceHost" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "contentPackageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRenderReady" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isThresholdEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastPackageValidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SpiritualLifeGuide_publicRenderReady_idx" ON "SpiritualLifeGuide" ("publicRenderReady");
CREATE INDEX IF NOT EXISTS "SpiritualLifeGuide_isThresholdEligible_idx" ON "SpiritualLifeGuide" ("isThresholdEligible");
CREATE INDEX IF NOT EXISTS "SpiritualLifeGuide_sacramentKey_idx" ON "SpiritualLifeGuide" ("sacramentKey");
CREATE INDEX IF NOT EXISTS "SpiritualLifeGuide_subtype_idx" ON "SpiritualLifeGuide" ("subtype");

-- ---------------------------------------------------------------------
-- Parish: package validation columns.
-- ---------------------------------------------------------------------
ALTER TABLE "Parish"
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "packageValidationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "contentPackageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRenderReady" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isThresholdEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastPackageValidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Parish_publicRenderReady_idx" ON "Parish" ("publicRenderReady");
CREATE INDEX IF NOT EXISTS "Parish_isThresholdEligible_idx" ON "Parish" ("isThresholdEligible");

-- ---------------------------------------------------------------------
-- IngestionSource: source-purpose allowlist columns. A source approved
-- for saints is NOT automatically approved for prayers; every content
-- type carries its own boolean flag. When all flags are NULL the
-- pre-strict-QA defaults apply (back-compat); the strict QA pipeline
-- treats NULL the same as FALSE.
-- ---------------------------------------------------------------------
ALTER TABLE "IngestionSource"
  ADD COLUMN IF NOT EXISTS "canIngestPrayers" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestSaints" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestApparitions" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestParishes" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestDevotions" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestNovenas" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestSacraments" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestRosaryGuides" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestConsecrations" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestSpiritualGuides" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestLiturgy" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canIngestHistory" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "canProvideScriptureText" BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------
-- RejectedContentLog: every delete or reject decision made by the
-- strict QA pipeline writes one row here. The DataManagementLog table
-- continues to capture run-level audit; this table is the strict QA
-- forensic record for individual items.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "RejectedContentLog" (
  "id" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "slug" TEXT,
  "originalTitle" TEXT,
  "sourceUrl" TEXT,
  "sourceHost" TEXT,
  "rejectionReason" TEXT NOT NULL,
  "failedContractName" TEXT,
  "failedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "originalChecksum" TEXT,
  "decision" TEXT NOT NULL,
  "triggeredBy" TEXT NOT NULL DEFAULT 'automatic',
  "actorUsername" TEXT,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RejectedContentLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RejectedContentLog_contentType_deletedAt_idx"
  ON "RejectedContentLog" ("contentType", "deletedAt");
CREATE INDEX IF NOT EXISTS "RejectedContentLog_decision_deletedAt_idx"
  ON "RejectedContentLog" ("decision", "deletedAt");
CREATE INDEX IF NOT EXISTS "RejectedContentLog_sourceHost_deletedAt_idx"
  ON "RejectedContentLog" ("sourceHost", "deletedAt");
CREATE INDEX IF NOT EXISTS "RejectedContentLog_deletedAt_idx"
  ON "RejectedContentLog" ("deletedAt");
