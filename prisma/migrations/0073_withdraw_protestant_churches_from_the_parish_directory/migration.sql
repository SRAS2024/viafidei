-- @idempotent-recoverable
--
-- Churches the map tagged as Catholic whose own names say they are Protestant.
--
-- WHY: the parish directory opened on "Gamri Gyohoe (감리교회)", which means "Methodist
-- Church", labelled a parish: OpenStreetMap had tagged it denomination=catholic. The
-- name is the better witness. These are the names of other communions: the Korean
-- Methodist, Presbyterian, Baptist, Holiness, Full Gospel, Lutheran and Anglican churches
-- and the Salvation Army, and in English only the words that never name a Catholic
-- church (not "Baptist": St. John the Baptist is a Catholic parish everywhere). The
-- import now refuses the same names (PROTESTANT_NAME_RE in
-- src/lib/admin-worker/parish-osm.ts), so a later sweep does not bring them back.
--
-- They are unpublished, not deleted, the way the worker's deletion gate does it, so a
-- row can be restored by setting "isPublished" back.
--
-- Deploy safety: one targeted update, no schema change. Safe to run again: a row already
-- withdrawn no longer matches.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent"
SET "isPublished" = false,
    "unpublishedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "isPublished"
  AND "contentType" = 'PARISH'::"ChecklistContentType"
  AND "title" ~* '감리교회|장로교회|침례교회|성결교회|순복음|루터교회|성공회|구세군|\y(methodist|presbyterian|lutheran|pentecostal|seventh-day adventist)\y';
