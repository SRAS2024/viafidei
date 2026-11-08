-- @idempotent-recoverable
--
-- Three records that are not saints of the Church.
--
-- WHY: Simon of Trent, Werner of Oberwesel and Dominguito del Val were published from a
-- data source as a blessed and two saints, with feast days and patronages. Each is a
-- child "martyr" of the blood libel, a slander invented to accuse Jews of murder, as
-- their own pages say. The Church suppressed the cult of Simon of Trent in 1965, and
-- Werner of Oberwesel was taken out of the Trier calendar in 1963; Dominguito del Val
-- was never a saint of the Church. The import now refuses these cults by name
-- (src/lib/content-shared/suppressed-cults.ts).
--
-- They are unpublished, not deleted, the way the worker's deletion gate does it, and
-- their checklist items are rejected so that no later pass rebuilds them.
--
-- Deploy safety: two short targeted updates, no schema change. Safe to run again: a row
-- already withdrawn no longer matches.
SET LOCAL lock_timeout = '5s';

UPDATE "ChecklistItem"
SET "approvalStatus" = 'REJECTED'::"ChecklistApprovalStatus",
    "rejectedAt" = CURRENT_TIMESTAMP,
    "rejectedReason" = 'Withdrawn: a suppressed cult of the blood libel, not a saint of the Church.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
  AND "id" IN (
    SELECT "checklistItemId" FROM "PublishedContent"
    WHERE "contentType" = 'SAINT'::"ChecklistContentType"
      AND "slug" IN ('saint-simon-of-trent', 'saint-werner-of-oberwesel', 'saint-dominguito-del-val')
  );

UPDATE "PublishedContent"
SET "isPublished" = false,
    "unpublishedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "isPublished"
  AND "contentType" = 'SAINT'::"ChecklistContentType"
  AND "slug" IN ('saint-simon-of-trent', 'saint-werner-of-oberwesel', 'saint-dominguito-del-val');
