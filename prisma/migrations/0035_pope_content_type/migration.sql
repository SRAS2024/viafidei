-- 0035_pope_content_type
--
-- Add POPE to the publishable content catalog so the Admin Worker can publish
-- the chronological list of popes (name + dates of papacy) to PublishedContent
-- like every other content type. Idempotent: ADD VALUE IF NOT EXISTS is a
-- no-op if the value already exists, so this migration is safe to re-apply.
ALTER TYPE "ChecklistContentType" ADD VALUE IF NOT EXISTS 'POPE';
