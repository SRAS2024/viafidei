-- 0037_rite_content_type
--
-- Add RITE to the publishable content catalog so the Admin Worker can publish
-- each Catholic rite (name + history) to PublishedContent like every other
-- content type. Idempotent: ADD VALUE IF NOT EXISTS is a no-op if the value
-- already exists, so this migration is safe to re-apply.
ALTER TYPE "ChecklistContentType" ADD VALUE IF NOT EXISTS 'RITE';
