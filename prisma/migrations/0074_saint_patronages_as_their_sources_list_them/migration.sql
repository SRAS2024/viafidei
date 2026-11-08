-- @idempotent-recoverable
--
-- The patronages of six of the most-read saints, as their sources list them.
--
-- WHY: the import split a Wikipedia infobox's patronage list at its commas after a line
-- break had already been read as a space, so items ran together. Saint Joachim was
-- "Patron of Fathers grandparents Adjuntas, Puerto Rico Dolores, Eastern Samar Fasnia,
-- Tenerife Carmelites San Joaquin, Iloilo"; Saint Michael's list opened on one of his
-- titles ("Guardian of the Catholic Church") and ran "Israel Normandy" together where a
-- footnote stood between them; Saint Willibrord named the Netherlands twice, once from
-- "Archdiocese of Utrecht, Netherlands"; Saint Mary of Bethany's subtitle read "patron of
-- Patroness of Spiritual Studies"; Saint John's list read "Love, loyalty, …
-- burn-victims, poison-victims, art-dealers". The import now reads line breaks as
-- separators and keeps a place with its country (wikipedia-infobox.ts, patronageItems in
-- ingestors.ts), and the page leaves out titles and labels a source wrote into the list
-- (saintPatronage in src/lib/content-shared/saints.ts), but stored lists stay as they were
-- written until they are corrected.
--
-- Each list below is everything the site showed, told apart and worded to follow "Patron
-- of", with what a second source adds: the Catholic Encyclopedia ("patron of the Church" for
-- Saint Michael), Catholic Online, EWTN, the Carmelite Order, the Holy See, Vatican News and
-- the dioceses concerned. Nothing the site showed is left out; the only word that goes is
-- Saint Willibrord's second "Netherlands". The subtitle, which names the first patronage,
-- is re-projected with the list.
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: one targeted update, no schema change. Safe to run again: a row is changed
-- only while its stored list, read in order, is still exactly the one the live site showed.
SET LOCAL lock_timeout = '5s';

WITH corrected("slug", "oldList", "newList", "oldSubtitle", "newSubtitle") AS (VALUES
  ('saint-michael',
   'Guardian of the Catholic Church, Vatican City, Rome, Lazio, Italy, Germany, Israel Normandy, France, Kyiv, Ukraine, Laoang, dying people',
   '["the Church", "the dying", "the souls in purgatory", "police officers", "soldiers", "grocers", "Vatican City", "Rome", "Lazio", "Italy", "Germany", "Israel", "Normandy", "France", "Kyiv", "Ukraine", "Laoang"]'::jsonb,
   'Saint, patron of Guardian of the Catholic Church · Feast September 29',
   'Saint, patron of the Church · Feast September 29'),
  ('saint-joachim',
   'Fathers grandparents Adjuntas, Puerto Rico Dolores, Eastern Samar Fasnia, Tenerife Carmelites San Joaquin, Iloilo',
   '["fathers", "grandparents", "Adjuntas, Puerto Rico", "Dolores, Eastern Samar", "Fasnia, Tenerife", "the Carmelites", "San Joaquin, Iloilo"]'::jsonb,
   'Saint, patron of Fathers grandparents Adjuntas · Feast July 26',
   'Saint, patron of fathers · Feast July 26'),
  ('saint-john-the-apostle',
   'Love, loyalty, friendships, authors, booksellers, burn-victims, poison-victims, art-dealers, editors, publishers, scribes, examinations',
   '["love", "loyalty", "friendships", "authors", "booksellers", "burn victims", "poison victims", "art dealers", "editors", "publishers", "scribes", "examinations", "theologians", "Asia Minor"]'::jsonb,
   'Apostle, patron of Love · Feast December 27',
   'Apostle, patron of love · Feast December 27'),
  ('saint-willibrord',
   'Convulsions, epilepsy, epileptics, Luxembourg, Netherlands, Archdiocese of Utrecht, Netherlands',
   '["convulsions", "epilepsy", "epileptics", "Luxembourg", "the Netherlands", "the Archdiocese of Utrecht"]'::jsonb,
   'Bishop, patron of Convulsions · Feast November 7',
   'Bishop, patron of convulsions · Feast November 7'),
  ('saint-gabriel-of-our-lady-of-sorrows',
   'Students, Youth, Clerics, Seminarians, Abruzzi',
   '["students", "youth", "clerics", "seminarians", "the Abruzzi"]'::jsonb,
   'Confessor, patron of Students · Feast February 27',
   'Confessor, patron of students · Feast February 27'),
  ('saint-mary-of-bethany',
   'Patroness of Spiritual Studies, Lectors, Commentators in the Philippines',
   '["spiritual studies", "lectors", "commentators in the Philippines"]'::jsonb,
   'Saint, patron of Patroness of Spiritual Studies · Feast July 29',
   'Saint, patron of spiritual studies · Feast July 29')
)
UPDATE "PublishedContent" AS content
SET "payload" = jsonb_set(content."payload", '{patronages}', corrected."newList"),
    "subtitle" = CASE
      WHEN content."subtitle" = corrected."oldSubtitle" THEN corrected."newSubtitle"
      ELSE content."subtitle"
    END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM corrected
WHERE content."contentType" = 'SAINT'::"ChecklistContentType"
  AND content."slug" = corrected."slug"
  AND jsonb_typeof(content."payload"->'patronages') = 'array'
  AND (
    SELECT string_agg(item.value, ', ' ORDER BY item.position)
    FROM jsonb_array_elements_text(content."payload"->'patronages') WITH ORDINALITY AS item(value, position)
  ) = corrected."oldList";
