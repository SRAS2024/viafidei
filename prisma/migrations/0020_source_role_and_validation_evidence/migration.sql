-- Source roles describe what a source is *allowed* to do in the
-- factory pipeline. A freshly added source defaults to
-- `discovery_only_source`: it can suggest candidate URLs but cannot
-- publish content until an admin (or the automatic promotion job)
-- moves it up to validation_source or primary_content_source.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SourceRole') THEN
    CREATE TYPE "SourceRole" AS ENUM (
      'primary_content_source',
      'validation_source',
      'enrichment_source',
      'discovery_only_source',
      'rejected_source'
    );
  END IF;
END$$;

ALTER TABLE "IngestionSource"
  ADD COLUMN IF NOT EXISTS "role" "SourceRole" NOT NULL DEFAULT 'discovery_only_source';

ALTER TABLE "IngestionSource"
  ADD COLUMN IF NOT EXISTS "roleLastReason" TEXT;

ALTER TABLE "IngestionSource"
  ADD COLUMN IF NOT EXISTS "roleLastChangedAt" TIMESTAMP(3);

-- Cross-source validation evidence. Every required field on a
-- built package must have at least one `pass` row before strict QA
-- is allowed to publish the package — unless the field is filled
-- by a deterministic internal rule or by approved enrichment.
CREATE TABLE IF NOT EXISTS "ContentValidationEvidence" (
  "id"                 TEXT NOT NULL PRIMARY KEY,
  "packageId"          TEXT,
  "candidateSlug"      TEXT,
  "contentType"        TEXT NOT NULL,
  "fieldName"          TEXT NOT NULL,
  "sourceUrl"          TEXT NOT NULL,
  "sourceHost"         TEXT NOT NULL,
  "evidenceType"       TEXT NOT NULL,
  "evidenceChecksum"   TEXT,
  "matchedValue"       TEXT,
  "matchConfidence"    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "validationDecision" TEXT NOT NULL,
  "reason"             TEXT,
  "buildLogId"         TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ContentValidationEvidence_packageId_idx"
  ON "ContentValidationEvidence" ("packageId");
CREATE INDEX IF NOT EXISTS "ContentValidationEvidence_candidateSlug_idx"
  ON "ContentValidationEvidence" ("candidateSlug");
CREATE INDEX IF NOT EXISTS "ContentValidationEvidence_contentType_fieldName_idx"
  ON "ContentValidationEvidence" ("contentType", "fieldName");
CREATE INDEX IF NOT EXISTS "ContentValidationEvidence_sourceHost_idx"
  ON "ContentValidationEvidence" ("sourceHost");
CREATE INDEX IF NOT EXISTS "ContentValidationEvidence_validationDecision_idx"
  ON "ContentValidationEvidence" ("validationDecision");
