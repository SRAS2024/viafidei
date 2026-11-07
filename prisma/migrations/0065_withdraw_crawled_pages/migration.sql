-- @idempotent-recoverable
--
-- Pages the web crawl published that are not what they were filed as.
--
-- WHY: reading every title on the site while putting the lists in order turned these
-- up. One prayer page reprints strangers' personal prayer requests, with their names.
-- Others carry another organisation's donation appeal, ad counters or a site's language
-- menu, and a "saint" is an Athenian comic poet. They should not be public pages, and
-- nothing links to them.
--
-- They are unpublished, not deleted, the way the worker's deletion gate does it, so each
-- can be restored by setting "isPublished" back. Their checklist items are rejected so
-- that no later pass rebuilds them from the same source.
--
-- Deploy safety: two short targeted updates, no schema change. Safe to run again: a row
-- already withdrawn no longer matches.
SET LOCAL lock_timeout = '5s';

UPDATE "ChecklistItem"
SET "approvalStatus" = 'REJECTED'::"ChecklistApprovalStatus",
    "rejectedAt" = CURRENT_TIMESTAMP,
    "rejectedReason" = 'Withdrawn: a crawled page that is not what it was filed as.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
  AND "id" IN (
    SELECT "checklistItemId" FROM "PublishedContent"
    WHERE ("contentType" = 'PRAYER'::"ChecklistContentType" AND "slug" IN (
            'a-guide-for-confession',
            'el-rosario-santo',
            'prayer-of-the-day-for-tuesday-july-7',
            'prayer-videos',
            'saint-prayers-our-catholic-faith',
            'send-deacon-keith-your-prayer-requests',
            'the-holy-rosary',
            'the-memorare-prayers-vatican-news',
            'traditional-catholic-prayers-33-prayers-with-their-history'
          ))
       OR ("contentType" = 'SAINT'::"ChecklistContentType" AND "slug" IN (
            'saint-archippus-q276575',
            'st-francis-xavier-saints-angels-catholic-online'
          ))
  );

UPDATE "PublishedContent"
SET "isPublished" = false,
    "unpublishedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "isPublished"
  AND (("contentType" = 'PRAYER'::"ChecklistContentType" AND "slug" IN (
         'a-guide-for-confession',
         'el-rosario-santo',
         'prayer-of-the-day-for-tuesday-july-7',
         'prayer-videos',
         'saint-prayers-our-catholic-faith',
         'send-deacon-keith-your-prayer-requests',
         'the-holy-rosary',
         'the-memorare-prayers-vatican-news',
         'traditional-catholic-prayers-33-prayers-with-their-history'
       ))
    OR ("contentType" = 'SAINT'::"ChecklistContentType" AND "slug" IN (
         'saint-archippus-q276575',
         'st-francis-xavier-saints-angels-catholic-online'
       )));
