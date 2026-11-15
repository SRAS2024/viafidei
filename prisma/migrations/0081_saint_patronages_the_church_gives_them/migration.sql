-- @idempotent-recoverable
--
-- The patronages of the two saints canonized on 7 September 2025, and two lists set right.
--
-- WHY: Saint Carlo Acutis and Saint Pier Giorgio Frassati were published with no patronage
-- at all, because the article their import read had none to give, and two lists ran their
-- items together or opened on a capital: Saint Laurence O'Toole read "Patron of Archdiocese
-- of Dublin. Head injury", and Saint Albert the Great "Patron of Those who cultivate the
-- natural sciences". Nothing in the worker rewrites a patronage, so the stored lists are
-- corrected here; the subtitle, which names the first patronage, is re-projected exactly as
-- the application writes it (src/lib/content-shared/content-subtitle.ts).
--
-- The sources, each read for this change:
--   Carlo Acutis: patron "of computer programmers and youth" (Catholic Online,
--     https://www.catholic.org/saints/saint.php?saint_id=46077), and one of the thirteen
--     patrons of World Youth Day Lisbon 2023 (Dicastery for Laity, Family and Life,
--     https://www.laityfamilylife.va/content/laityfamilylife/en/news/2022/i-13-santi-patroni-della-gmg-2023.html).
--     "Patron of the internet" is not added: no act of the Holy See names it.
--   Pier Giorgio Frassati: "the patron saint of athletes" (Pope Leo XIV, homily for the
--     Jubilee of Sport, 15 June 2025, https://www.vatican.va/content/leo-xiv/en/homilies/2025/documents/20250615-omelia-giubileo-sport.html);
--     patron of mountain people, of Catholic Action and above all of students (Vatican
--     News, 6 September 2025, https://www.vaticannews.va/pl/kosciol/news/2025-09/swiety-z-fajka-patron-studentow-kanonizowany.html);
--     patron "of students, young Catholics, and mountaineers" (Catholic Online,
--     https://www.catholic.org/saints/saint.php?saint_id=6994); patron of young adults
--     (USCCB, https://www.usccb.org/committees/laity-marriage-family-life-youth/patron-saints);
--     one of the patrons of World Youth Day Lisbon 2023 (the Dicastery's list above).
--   Laurence O'Toole: "Patron Saint of the Archdiocese of Dublin" (Archdiocese of Dublin,
--     https://www.dublindiocese.ie/the-story-of-st-laurence-otoole/; Catholic Online,
--     https://www.catholic.org/saints/saint.php?saint_id=4213). "Head injury", which the
--     import ran into the same entry, is kept as the site showed it, as its own entry.
--   Albert the Great: heavenly patron of those who cultivate the natural sciences (Pius
--     XII, apostolic letter of 16 December 1941, AAS 34 (1942) 89-91; Benedict XVI, general
--     audience of 24 March 2010, https://www.vatican.va/content/benedict-xvi/en/audiences/2010/documents/hf_ben-xvi_aud_20100324.html);
--     patron of scientists, philosophers and medical technicians (Franciscan Media,
--     https://www.franciscanmedia.org/saint-of-the-day/saint-albert-the-great/; Catholic
--     Online, https://www.catholic.org/saints/saint.php?saint_id=144). Only the capital of
--     the first entry changes.
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: one targeted update, no schema change. Safe to run again: a row is changed
-- only while its stored list, read as the page reads it (each entry trimmed, without a final
-- full stop, in order), is still exactly the one the live site showed; for the two new
-- saints, only while they still have none.
SET LOCAL lock_timeout = '5s';

WITH corrected("slug", "oldList", "newList", "oldSubtitle", "newSubtitle") AS (VALUES
  ('saint-carlo-acutis',
   '',
   '["young people", "computer programmers"]'::jsonb,
   'Saint · Feast October 12',
   'Saint, patron of young people · Feast October 12'),
  ('saint-pier-giorgio-frassati',
   '',
   '["young people", "students", "athletes", "mountaineers", "Catholic Action"]'::jsonb,
   'Confessor · Feast July 4',
   'Confessor, patron of young people · Feast July 4'),
  ('saint-lorcan-ua-tuathail',
   'Archdiocese of Dublin. Head injury',
   '["the Archdiocese of Dublin", "head injuries"]'::jsonb,
   'Bishop, patron of Archdiocese of Dublin. Head injury · Feast November 14',
   'Bishop, patron of the Archdiocese of Dublin · Feast November 14'),
  ('saint-albertus-magnus',
   'Those who cultivate the natural sciences, medical technicians, philosophers, scientists',
   '["those who cultivate the natural sciences", "medical technicians", "philosophers", "scientists"]'::jsonb,
   'Bishop, patron of Those who cultivate the natural sciences · Feast November 15',
   'Bishop, patron of those who cultivate the natural sciences · Feast November 15')
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
  AND CASE
    WHEN content."payload"->'patronages' IS NULL
      OR jsonb_typeof(content."payload"->'patronages') = 'null' THEN ''
    WHEN jsonb_typeof(content."payload"->'patronages') = 'array' THEN COALESCE((
      SELECT string_agg(regexp_replace(btrim(item.value), '\.$', ''), ', ' ORDER BY item.position)
      FROM jsonb_array_elements_text(content."payload"->'patronages') WITH ORDINALITY AS item(value, position)
    ), '')
  END = corrected."oldList";
