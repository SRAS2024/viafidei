-- @idempotent-recoverable
--
-- The feast of Saints Philip and James, and the devotion to Saint Jude, lead to each
-- Apostle's own page.
--
-- WHY: Philip and James the Less each have a page of their own, and the record that
-- holds them together is now hidden from the saint list as their duplicate. The May 3
-- feast still linked that combined record, and so did the devotion to Saint Jude, whose
-- related saint is James the Less, the "brother of James" the Letter of Jude names (Jude
-- 1:1); Philip has nothing to do with it. The curated entries now name the Apostles'
-- own records (src/lib/checklist/knowledge/liturgical/group-1.ts and
-- devotions/group-2.ts), and /history links the martyrdom of James to James the Less.
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: two short targeted updates, no schema change. Safe to run again: a row
-- is changed only while it still links exactly the old records.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{associatedSaintSlugs}', '["saint-philip-the-apostle", "saint-james-the-less"]'::jsonb),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'LITURGICAL'::"ChecklistContentType"
  AND "slug" = 'feast-saints-philip-and-james'
  AND "payload"->'associatedSaintSlugs' = '["saints-philip-and-james"]'::jsonb;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{relatedSaints}', '["saint-jude-thaddeus", "saint-james-the-less"]'::jsonb),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'DEVOTION'::"ChecklistContentType"
  AND "slug" = 'devotion-to-saint-jude'
  AND "payload"->'relatedSaints' = '["saint-jude-thaddeus", "saints-philip-and-james"]'::jsonb;
