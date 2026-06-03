-- 0034_parish_content_type
--
-- Add PARISH to the publishable content catalog so the Admin Worker can
-- publish parish directory records (parish / shrine / cathedral / basilica)
-- to PublishedContent like every other content type. Idempotent: ADD VALUE
-- IF NOT EXISTS is a no-op if the value already exists, so this migration is
-- safe to re-apply.
ALTER TYPE "ChecklistContentType" ADD VALUE IF NOT EXISTS 'PARISH';
