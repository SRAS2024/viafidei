-- @idempotent-recoverable
--
-- The First Saturdays devotion, dated as Fátima and Pontevedra date it.
--
-- WHY: the devotion's page said that it "was requested by the Virgin Mary during the
-- apparitions of Our Lady of Fátima in Fátima, Portugal, on 13 May 1917, as well as during
-- apparitions in Pontevedra, Spain, on 10 December 1925 and 15 February 1926". Our Lady
-- spoke of the Communion of reparation on the First Saturdays at Fátima on 13 July 1917,
-- not 13 May ("I shall come to ask for the consecration of Russia to my Immaculate Heart,
-- and the Communion of reparation on the First Saturdays": Congregation for the Doctrine of
-- the Faith, The Message of Fatima, 2000,
-- https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_20000626_message-fatima_en.html).
-- She made the request at Pontevedra on 10 December 1925, appearing to Sister Lúcia with
-- the Child Jesus, and on 15 February 1926 it was the Child Jesus who appeared there again
-- and asked whether she had spread the devotion (Fátima Sanctuary, chronology and
-- narrative of the apparitions, https://www.fatima.pt/en/pages/chronology-of-the-three-seers
-- and https://www.fatima.pt/en/pages/narrative-of-the-apparitions-). The clause is
-- corrected in place and every other word stays.
--
-- The summary is the text's opening as the import now cuts it, on a whole word and marked
-- with "…" (leadText in src/lib/admin-worker/structured/ingestors.ts): the old one ended in
-- the middle of "as" ("…on 13 May 1917, a").
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: one targeted update, no schema change. Safe to run again: a field is
-- changed only while it still holds the old words, and the row only while one does.
SET LOCAL lock_timeout = '5s';

WITH corrected("oldClause", "newClause", "oldSummary", "newSummary") AS (VALUES (
  'was requested by the Virgin Mary during the apparitions of Our Lady of Fátima in Fátima, Portugal, on 13 May 1917, as well as during apparitions in Pontevedra, Spain, on 10 December 1925 and 15 February 1926.',
  'the Virgin Mary announced during the apparitions of Our Lady of Fátima in Fátima, Portugal, on 13 July 1917, and requested during an apparition in Pontevedra, Spain, on 10 December 1925; on 15 February 1926 the Child Jesus asked Lúcia there whether she had spread it.',
  'The First Saturdays Devotion, also called the Communion of Reparation to the Immaculate Heart of Mary, is a Catholic devotion which, according to Lúcia dos Santos, was requested by the Virgin Mary during the apparitions of Our Lady of Fátima in Fátima, Portugal, on 13 May 1917, a',
  'The First Saturdays Devotion, also called the Communion of Reparation to the Immaculate Heart of Mary, is a Catholic devotion which, according to Lúcia dos Santos, the Virgin Mary announced during the apparitions of Our Lady of Fátima in Fátima, Portugal, on 13 July 1917, and…'
))
UPDATE "PublishedContent" AS content
SET "payload" = content."payload"
      || CASE
        WHEN content."payload"->>'summary' = corrected."oldSummary"
          THEN jsonb_build_object('summary', corrected."newSummary")
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN strpos(content."payload"->>'background', corrected."oldClause") > 0
          THEN jsonb_build_object(
            'background',
            replace(content."payload"->>'background', corrected."oldClause", corrected."newClause")
          )
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN strpos(content."payload"->>'practiceInstructions', corrected."oldClause") > 0
          THEN jsonb_build_object(
            'practiceInstructions',
            replace(
              content."payload"->>'practiceInstructions',
              corrected."oldClause",
              corrected."newClause"
            )
          )
        ELSE '{}'::jsonb
      END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM corrected
WHERE content."contentType" = 'DEVOTION'::"ChecklistContentType"
  AND content."slug" = 'first-saturday-devotions'
  AND (
    content."payload"->>'summary' = corrected."oldSummary"
    OR strpos(content."payload"->>'background', corrected."oldClause") > 0
    OR strpos(content."payload"->>'practiceInstructions', corrected."oldClause") > 0
  );
