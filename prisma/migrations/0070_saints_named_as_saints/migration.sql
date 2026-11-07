-- @idempotent-recoverable
--
-- The best-known saints, called saints.
--
-- WHY: the saint list opens with the people readers know best, and nearly all of them are
-- stored as "Saint Peter", "Saint Clare". These fifteen came in from a data source as bare
-- names, so the sixth name on the page read "John the Apostle" between Saint James and Saint
-- Andrew, and "Joachim" followed Saint Anne. Each was checked by hand: all are saints of the
-- Roman Martyrology or of long-standing Catholic veneration. This is deliberately not a rule
-- for the whole catalogue, where the stored status is not reliable enough to add the word
-- by machine. The checklist item's name moves with the title, so neither pass of the worker
-- sees a difference to put back.
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: short targeted updates, no schema change, no version row. Safe to run again,
-- and a no-op on a row that is not called exactly the old name.
SET LOCAL lock_timeout = '5s';

WITH named("slug", "oldName", "newName") AS (VALUES
  ('saint-john-the-apostle', 'John the Apostle', 'Saint John the Apostle'),
  ('saint-joachim', 'Joachim', 'Saint Joachim'),
  ('saint-mary-of-bethany', 'Mary of Bethany', 'Saint Mary of Bethany'),
  ('saint-lazarus-of-bethany', 'Lazarus of Bethany', 'Saint Lazarus of Bethany'),
  ('saint-expeditus', 'Expeditus', 'Saint Expeditus'),
  ('saint-olaf-ii-of-norway', 'Olaf II of Norway', 'Saint Olaf II of Norway'),
  ('saint-nicodemus', 'Nicodemus', 'Saint Nicodemus'),
  ('saint-longinus', 'Longinus', 'Saint Longinus'),
  ('saint-mary-of-clopas', 'Mary of Clopas', 'Saint Mary of Clopas'),
  ('saint-philemon', 'Philemon', 'Saint Philemon'),
  ('saint-salome', 'Salome', 'Saint Salome'),
  ('saint-lydia-of-thyatira', 'Lydia of Thyatira', 'Saint Lydia of Thyatira'),
  ('saint-phoebe', 'Phoebe', 'Saint Phoebe'),
  ('saint-dorcas', 'Dorcas', 'Saint Dorcas'),
  ('saint-john-of-nepomuk', 'John of Nepomuk', 'Saint John of Nepomuk')
)
UPDATE "PublishedContent" AS content
SET "title" = named."newName",
    "payload" = CASE
      WHEN content."payload"->>'canonicalName' = named."oldName"
        THEN jsonb_set(content."payload", '{canonicalName}', to_jsonb(named."newName"))
      ELSE content."payload"
    END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM named
WHERE content."contentType" = 'SAINT'::"ChecklistContentType"
  AND content."slug" = named."slug"
  AND content."title" = named."oldName";

WITH named("slug", "oldName", "newName") AS (VALUES
  ('saint-john-the-apostle', 'John the Apostle', 'Saint John the Apostle'),
  ('saint-joachim', 'Joachim', 'Saint Joachim'),
  ('saint-mary-of-bethany', 'Mary of Bethany', 'Saint Mary of Bethany'),
  ('saint-lazarus-of-bethany', 'Lazarus of Bethany', 'Saint Lazarus of Bethany'),
  ('saint-expeditus', 'Expeditus', 'Saint Expeditus'),
  ('saint-olaf-ii-of-norway', 'Olaf II of Norway', 'Saint Olaf II of Norway'),
  ('saint-nicodemus', 'Nicodemus', 'Saint Nicodemus'),
  ('saint-longinus', 'Longinus', 'Saint Longinus'),
  ('saint-mary-of-clopas', 'Mary of Clopas', 'Saint Mary of Clopas'),
  ('saint-philemon', 'Philemon', 'Saint Philemon'),
  ('saint-salome', 'Salome', 'Saint Salome'),
  ('saint-lydia-of-thyatira', 'Lydia of Thyatira', 'Saint Lydia of Thyatira'),
  ('saint-phoebe', 'Phoebe', 'Saint Phoebe'),
  ('saint-dorcas', 'Dorcas', 'Saint Dorcas'),
  ('saint-john-of-nepomuk', 'John of Nepomuk', 'Saint John of Nepomuk')
)
UPDATE "ChecklistItem" AS item
SET "canonicalName" = named."newName",
    "updatedAt" = CURRENT_TIMESTAMP
FROM named
WHERE item."contentType" = 'SAINT'::"ChecklistContentType"
  AND item."canonicalSlug" = named."slug"
  AND item."canonicalName" = named."oldName";
