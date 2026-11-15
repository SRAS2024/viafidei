-- @idempotent-recoverable
--
-- The Chaste Heart of Joseph, filed as a devotion to a saint.
--
-- WHY: the devotions list labelled the Chaste Heart of Joseph "Marian devotion". It is a
-- devotion to Saint Joseph, the "most chaste" father of the Holy Family (Pope Francis,
-- Patris corde, 2020, https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20201208_patris-corde.html),
-- as its own page says; the import filed it under Mary because its text names the Blessed
-- Virgin, his spouse, and Wikidata lists it with the Marian devotions. The import now files
-- a devotion named for Saint Joseph as a devotion to a saint, in the words it uses for one
-- (classifyDevotionType in src/lib/admin-worker/structured/ingestors.ts), and the stored
-- type and the filter column read from it move together.
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: one targeted update, no schema change. Safe to run again: the row is
-- changed only while it is still filed as a Marian devotion.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent" AS content
SET "payload" = jsonb_set(content."payload", '{devotionType}', '"Devotion to a saint"'::jsonb),
    "subtype" = CASE
      WHEN content."subtype" = 'Marian devotion' THEN 'Devotion to a saint'
      ELSE content."subtype"
    END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE content."contentType" = 'DEVOTION'::"ChecklistContentType"
  AND content."slug" = 'chaste-heart-of-joseph'
  AND content."payload"->>'devotionType' = 'Marian devotion';
