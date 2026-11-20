-- @idempotent-recoverable
--
-- The Five First Saturdays, requested where Our Lady requested them.
--
-- WHY: the curated devotion "The Five First Saturdays" (src/lib/checklist/knowledge/
-- devotions.ts) said that "At Fatima the Blessed Virgin Mary asked for Communions of
-- reparation to her Immaculate Heart on the first Saturdays, promising her assistance at the
-- hour of death". At Fátima, on 13 July 1917, she said she would COME to ask for the
-- Communion of reparation on the First Saturdays (Congregation for the Doctrine of the Faith,
-- The Message of Fatima, 2000, https://www.vatican.va/roman_curia/congregations/cfaith/
-- documents/rc_con_cfaith_doc_20000626_message-fatima_en.html); she asked for it, with the
-- promise of her help at the hour of death, at Pontevedra on 10 December 1925 (Fátima
-- Sanctuary, https://www.fatima.pt/en/pages/narrative-of-the-apparitions-). Migration 0083
-- set the same facts right on the First Saturdays Devotion; this is its curated sibling.
-- Every other word stays, and the curated file says the same, so a new seed agrees.
--
-- Deploy safety: one targeted update, no schema change. Safe to run again: a field changes
-- only while it still holds the old words.
SET LOCAL lock_timeout = '5s';

WITH corrected("oldSummary", "newSummary", "oldBackground", "newBackground") AS (VALUES (
  'A devotion of reparation to the Immaculate Heart of Mary requested at Fatima, made on the first Saturday of five consecutive months.',
  'A devotion of reparation to the Immaculate Heart of Mary, announced at Fatima and requested at Pontevedra, made on the first Saturday of five consecutive months.',
  'At Fatima the Blessed Virgin Mary asked for Communions of reparation to her Immaculate Heart on the first Saturdays, promising her assistance at the hour of death to those who fulfill the devotion.',
  'At Fatima, on 13 July 1917, the Blessed Virgin Mary said she would come to ask for the Communion of reparation on the first Saturdays; at Pontevedra, on 10 December 1925, she asked for Communions of reparation to her Immaculate Heart on the first Saturdays, promising her assistance at the hour of death to those who fulfill the devotion.'
))
UPDATE "PublishedContent" AS content
SET "payload" = content."payload"
      || CASE
        WHEN content."payload"->>'summary' = corrected."oldSummary"
          THEN jsonb_build_object('summary', corrected."newSummary")
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN content."payload"->>'background' = corrected."oldBackground"
          THEN jsonb_build_object('background', corrected."newBackground")
        ELSE '{}'::jsonb
      END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM corrected
WHERE content."contentType" = 'DEVOTION'::"ChecklistContentType"
  AND content."slug" = 'five-first-saturdays'
  AND (
    content."payload"->>'summary' = corrected."oldSummary"
    OR content."payload"->>'background' = corrected."oldBackground"
  );
