-- @idempotent-recoverable
--
-- Saint Joachim and Saint Mary of Bethany on their Roman feasts.
--
-- WHY: both came in from a data source with an Eastern date, so the feast-day lists of
-- this Roman Catholic site missed them: July 26 showed Saint Anne without her husband, and
-- July 29 Saint Martha without her sister. The General Roman Calendar keeps Saints
-- Joachim and Anne, Parents of the Blessed Virgin Mary, on July 26, and since 2021 Saints
-- Martha, Mary and Lazarus on July 29 (Congregation for Divine Worship, decree of 26
-- January 2021).
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: two short targeted updates, no schema change, no version row. Safe to run
-- again, and a no-op on a row whose stored feast is not exactly the old one.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{feastDay}', to_jsonb('07-26'::text)),
    "feastMonth" = 7,
    "feastDayOfMonth" = 26,
    "subtitle" = replace("subtitle", 'September 9', 'July 26'),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'SAINT'::"ChecklistContentType"
  AND "slug" = 'saint-joachim'
  AND "payload"->>'feastDay' = '09-09';

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{feastDay}', to_jsonb('07-29'::text)),
    "feastMonth" = 7,
    "feastDayOfMonth" = 29,
    "subtitle" = replace("subtitle", 'June 4', 'July 29'),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'SAINT'::"ChecklistContentType"
  AND "slug" = 'saint-mary-of-bethany'
  AND "payload"->>'feastDay' = '06-04';
