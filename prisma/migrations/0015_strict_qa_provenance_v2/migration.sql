-- Strict QA provenance v2. Adds the fields the strict cleanup loop
-- writes for every delete decision so an admin can prove WHY a row
-- was removed:
--
--   * packageVersion       — contract version that ran
--   * validationDecision   — final pipeline decision verbatim
--                            (delete / reject / archive / ...)
--   * failureCategory      — bucket the failure falls into for the
--                            dashboard ("wrong_content",
--                            "missing_required_field",
--                            "source_purpose_mismatch", ...)
--   * cleanupMode          — public_only | all_catalog_rows
--   * sweepReason          — short description of what kind of sweep
--                            triggered the deletion ("scheduled",
--                            "post_ingestion", "manual", "render_gate",
--                            "package_version_change", ...)
--   * originalStatus       — the row's status before deletion
--                            (PUBLISHED / REVIEW / DRAFT / ARCHIVED)
ALTER TABLE "RejectedContentLog"
  ADD COLUMN IF NOT EXISTS "packageVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "validationDecision" TEXT,
  ADD COLUMN IF NOT EXISTS "failureCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "cleanupMode" TEXT,
  ADD COLUMN IF NOT EXISTS "sweepReason" TEXT,
  ADD COLUMN IF NOT EXISTS "originalStatus" TEXT;

CREATE INDEX IF NOT EXISTS "RejectedContentLog_failureCategory_deletedAt_idx"
  ON "RejectedContentLog" ("failureCategory", "deletedAt");
CREATE INDEX IF NOT EXISTS "RejectedContentLog_cleanupMode_deletedAt_idx"
  ON "RejectedContentLog" ("cleanupMode", "deletedAt");
