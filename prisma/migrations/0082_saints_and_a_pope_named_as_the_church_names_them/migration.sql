-- @idempotent-recoverable
--
-- Three saints and a pope named as the Church names them.
--
-- WHY:
--   * Saint Nikola Tavelić was titled "Venerable Nikola Tavelić" ("Venerable · Martyr" under
--     his name), because Wikidata still gives him that stage. Pope Paul VI canonized him on
--     21 June 1970 with Deodatus of Rodez, Stephen of Cuneo and Peter of Narbonne (Paul VI,
--     homily of 21 June 1970, https://www.vatican.va/content/paul-vi/it/homilies/1970/documents/hf_p-vi_hom_19700621.html;
--     Franciscan Media, https://www.franciscanmedia.org/saint-of-the-day/saint-nicholas-tavelic-and-companions/).
--     His stage, title and subtitle move together; his feast, 14 November, stays.
--   * Pope John Paul I, beatified by Pope Francis in St Peter's Square on 4 September 2022
--     (homily, https://www.vatican.va/content/francesco/en/homilies/2022/documents/20220904-omelia-beatificazione-gpi.html;
--     Dicastery for the Causes of Saints, https://www.causesanti.va/it/santi-e-beati/giovanni-paolo-i-albino-luciani.html),
--     was the one beatified pope on the list without "Blessed", which Pius IX and Innocent XI
--     carry ("Pope Blessed Pius IX"). His curated entry now says so (src/lib/checklist/knowledge/popes.ts),
--     and its opening line, which repeats the title, moves with it, so the worker's curated
--     sync finds nothing to change.
--   * Saint Michael is called "Saint Michael the Archangel", as Saints Gabriel and Raphael
--     are called the Archangel beside him. His slug, and every link to it, stays.
--   * "Saint Arthur" (Arthur of Glastonbury, said to have died in 1539) is no saint of the
--     Church: the Glastonbury martyrs whom Leo XIII beatified in 1895 are Richard Whiting,
--     John Thorne and Roger James (Catholic Encyclopedia, "Ven. Richard Whiting",
--     https://www.newadvent.org/cathen/13046c.htm, and "English Confessors and Martyrs",
--     https://www.newadvent.org/cathen/05474a.htm), the Roman Martyrology names only them, and
--     no Catholic list of the English martyrs names an Arthur. Wikidata calls him a Catholic
--     saint, which is where "Saint" came from. He keeps his page and his place; only his
--     title loses the word, and the page prints no stage over it (STAGE_NOT_RECORDED in
--     src/lib/content-shared/saints.ts). Whether the entry stays is the owner's decision.
--
-- The worker re-derives a structured saint's stage and title from Wikidata and the stored
-- bare name (`canonicalName`); Tavelić's and Arthur's corrected stages are in
-- STAGE_CORRECTIONS (src/lib/admin-worker/structured/saint-facts.ts), and the bare names
-- stored here give back these titles, so neither pass puts the old ones back. The
-- checklist item's name moves with the title, as in migration 0070.
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: short targeted updates, no schema change. Safe to run again: each row is
-- changed only while it is still called exactly the old name.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent" AS content
SET "title" = 'Saint Nikola Tavelić',
    "payload" = content."payload"
      || '{"canonizationStatus": "canonized"}'::jsonb
      || CASE
        WHEN content."payload"->>'canonicalName' = 'Venerable Nikola Tavelić'
          THEN '{"canonicalName": "Nikola Tavelić"}'::jsonb
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN content."payload"->>'title' = 'Venerable Nikola Tavelić'
          THEN '{"title": "Saint Nikola Tavelić"}'::jsonb
        ELSE '{}'::jsonb
      END,
    "subtitle" = CASE
      WHEN content."subtitle" = 'Venerable · Martyr · Feast November 14' THEN 'Martyr · Feast November 14'
      ELSE content."subtitle"
    END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE content."contentType" = 'SAINT'::"ChecklistContentType"
  AND content."slug" = 'saint-nikola-tavelic'
  AND content."title" = 'Venerable Nikola Tavelić'
  AND content."payload"->>'canonizationStatus' = 'venerable';

UPDATE "PublishedContent" AS content
SET "title" = 'Saint Michael the Archangel',
    "payload" = content."payload"
      || '{"canonicalName": "Michael the Archangel"}'::jsonb
      || CASE
        WHEN content."payload"->>'title' = 'Saint Michael'
          THEN '{"title": "Saint Michael the Archangel"}'::jsonb
        ELSE '{}'::jsonb
      END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE content."contentType" = 'SAINT'::"ChecklistContentType"
  AND content."slug" = 'saint-michael'
  AND content."title" = 'Saint Michael';

UPDATE "PublishedContent" AS content
SET "title" = 'Arthur of Glastonbury',
    "payload" = content."payload"
      || CASE
        WHEN content."payload"->>'canonicalName' IN ('Saint Arthur', 'Arthur')
          THEN '{"canonicalName": "Arthur of Glastonbury"}'::jsonb
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN content."payload"->>'title' = 'Saint Arthur'
          THEN '{"title": "Arthur of Glastonbury"}'::jsonb
        ELSE '{}'::jsonb
      END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE content."contentType" = 'SAINT'::"ChecklistContentType"
  AND content."slug" = 'saint-arthur'
  AND content."title" = 'Saint Arthur';

UPDATE "PublishedContent" AS content
SET "title" = 'Pope Blessed John Paul I',
    "payload" = content."payload"
      || CASE
        WHEN content."payload"->>'title' = 'Pope John Paul I'
          THEN '{"title": "Pope Blessed John Paul I"}'::jsonb
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN content."payload"->>'summary' = 'Pope John Paul I, who reigned as Roman Pontiff from 1978–1978.'
          THEN '{"summary": "Pope Blessed John Paul I, who reigned as Roman Pontiff from 1978–1978."}'::jsonb
        ELSE '{}'::jsonb
      END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE content."contentType" = 'POPE'::"ChecklistContentType"
  AND content."slug" = 'pope-john-paul-i'
  AND content."title" = 'Pope John Paul I';

WITH named("contentType", "slug", "oldName", "newName") AS (VALUES
  ('SAINT', 'saint-nikola-tavelic', 'Venerable Nikola Tavelić', 'Saint Nikola Tavelić'),
  ('SAINT', 'saint-michael', 'Saint Michael', 'Saint Michael the Archangel'),
  ('SAINT', 'saint-arthur', 'Saint Arthur', 'Arthur of Glastonbury'),
  ('POPE', 'pope-john-paul-i', 'Pope John Paul I', 'Pope Blessed John Paul I')
)
UPDATE "ChecklistItem" AS item
SET "canonicalName" = named."newName",
    "updatedAt" = CURRENT_TIMESTAMP
FROM named
WHERE item."contentType" = named."contentType"::"ChecklistContentType"
  AND item."canonicalSlug" = named."slug"
  AND item."canonicalName" = named."oldName";
