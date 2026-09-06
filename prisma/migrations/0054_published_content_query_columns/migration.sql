-- Query columns derived from the published payload, so the site's hot filters
-- ("saints with a feast today", "parishes near me", chronological saint order,
-- filter chips by kind) run as indexed scans instead of loading whole content
-- types and parsing every JSON payload per request. Written at publish time by
-- the orchestrator (src/lib/content-shared/derived-columns.ts) and refreshed
-- for pre-existing rows by the worker's content-hygiene sweep. Additive and
-- nullable, with an idempotent backfill for the columns SQL can derive.

ALTER TABLE "PublishedContent"
  ADD COLUMN IF NOT EXISTS "feastMonth" INTEGER,
  ADD COLUMN IF NOT EXISTS "feastDayOfMonth" INTEGER,
  ADD COLUMN IF NOT EXISTS "sortYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "subtype" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "region" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT,
  ADD COLUMN IF NOT EXISTS "addressKey" TEXT;

-- Feast day: numeric pair first, then the "MM-DD" string.
UPDATE "PublishedContent"
SET "feastMonth" = (payload->>'feastMonth')::int,
    "feastDayOfMonth" = (payload->>'feastDayOfMonth')::int
WHERE "contentType" = 'SAINT' AND "feastMonth" IS NULL
  AND payload->>'feastMonth' ~ '^[0-9]{1,2}$' AND payload->>'feastDayOfMonth' ~ '^[0-9]{1,2}$'
  AND (payload->>'feastMonth')::int BETWEEN 1 AND 12 AND (payload->>'feastDayOfMonth')::int BETWEEN 1 AND 31;

UPDATE "PublishedContent"
SET "feastMonth" = split_part(payload->>'feastDay', '-', 1)::int,
    "feastDayOfMonth" = split_part(payload->>'feastDay', '-', 2)::int
WHERE "contentType" = 'SAINT' AND "feastMonth" IS NULL
  AND payload->>'feastDay' ~ '^[0-9]{2}-[0-9]{2}$'
  AND split_part(payload->>'feastDay', '-', 1)::int BETWEEN 1 AND 12
  AND split_part(payload->>'feastDay', '-', 2)::int BETWEEN 1 AND 31;

-- Classification used by filter chips.
UPDATE "PublishedContent"
SET "subtype" = COALESCE(
  CASE "contentType"
    WHEN 'SAINT' THEN NULLIF(payload->>'saintType', '')
    WHEN 'GUIDE' THEN NULLIF(payload->>'kind', '')
    WHEN 'PRAYER' THEN NULLIF(payload->>'prayerType', '')
    WHEN 'PARISH' THEN COALESCE(NULLIF(payload->>'designation', ''), 'parish')
    WHEN 'LITURGICAL' THEN COALESCE(NULLIF(payload->>'kind', ''), NULLIF(payload->>'liturgyType', ''))
    WHEN 'CHURCH_DOCUMENT' THEN NULLIF(payload->>'documentType', '')
    WHEN 'SPIRITUAL_PRACTICE' THEN COALESCE(NULLIF(payload->>'practiceKind', ''), NULLIF(payload->>'kind', ''))
    WHEN 'DEVOTION' THEN COALESCE(NULLIF(payload->>'devotionType', ''), NULLIF(payload->>'kind', ''))
    WHEN 'APPARITION' THEN NULLIF(payload->>'approvalStatus', '')
    ELSE NULLIF(payload->>'kind', '')
  END,
  NULLIF(payload->>'contentSubtype', ''))
WHERE "subtype" IS NULL;

-- Parish geography + provenance.
UPDATE "PublishedContent"
SET "latitude" = (payload->>'latitude')::float8,
    "longitude" = (payload->>'longitude')::float8
WHERE "contentType" = 'PARISH' AND "latitude" IS NULL
  AND payload->>'latitude' ~ '^-?[0-9]+(\.[0-9]+)?$' AND payload->>'longitude' ~ '^-?[0-9]+(\.[0-9]+)?$'
  AND (payload->>'latitude')::float8 BETWEEN -90 AND 90 AND (payload->>'longitude')::float8 BETWEEN -180 AND 180;

UPDATE "PublishedContent"
SET "region" = NULLIF(concat_ws('/', NULLIF(payload->>'country', ''), NULLIF(payload->>'state', ''), NULLIF(payload->>'city', '')), '')
WHERE "contentType" = 'PARISH' AND "region" IS NULL;

UPDATE "PublishedContent"
SET "addressKey" = NULLIF(payload->>'addressKey', '')
WHERE "contentType" = 'PARISH' AND "addressKey" IS NULL;

UPDATE "PublishedContent"
SET "sourceRef" = COALESCE(NULLIF(payload->>'sourceRef', ''), NULLIF(payload->>'placeId', ''))
WHERE "sourceRef" IS NULL AND (payload->>'sourceRef' IS NOT NULL OR payload->>'placeId' IS NOT NULL);

CREATE INDEX IF NOT EXISTS "PublishedContent_feast_idx"
  ON "PublishedContent"("contentType", "feastMonth", "feastDayOfMonth") WHERE "isPublished" = true;
CREATE INDEX IF NOT EXISTS "PublishedContent_type_subtype_idx"
  ON "PublishedContent"("contentType", "subtype") WHERE "isPublished" = true;
CREATE INDEX IF NOT EXISTS "PublishedContent_type_sortYear_idx"
  ON "PublishedContent"("contentType", "sortYear", "title") WHERE "isPublished" = true;
CREATE INDEX IF NOT EXISTS "PublishedContent_parish_geo_idx"
  ON "PublishedContent"("latitude", "longitude") WHERE "contentType" = 'PARISH' AND "isPublished" = true;
CREATE INDEX IF NOT EXISTS "PublishedContent_type_title_idx"
  ON "PublishedContent"("contentType", "title") WHERE "isPublished" = true;
CREATE INDEX IF NOT EXISTS "PublishedContent_sourceRef_idx"
  ON "PublishedContent"("sourceRef") WHERE "sourceRef" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PublishedContent_addressKey_idx"
  ON "PublishedContent"("addressKey") WHERE "addressKey" IS NOT NULL;
