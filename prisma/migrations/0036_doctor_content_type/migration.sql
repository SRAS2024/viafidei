-- 0036_doctor_content_type
--
-- Add DOCTOR (Doctor of the Church) to the publishable content catalog so the
-- Admin Worker can publish the Doctors of the Church to PublishedContent like
-- every other content type. Idempotent: ADD VALUE IF NOT EXISTS is a no-op if
-- the value already exists, so this migration is safe to re-apply.
ALTER TYPE "ChecklistContentType" ADD VALUE IF NOT EXISTS 'DOCTOR';
