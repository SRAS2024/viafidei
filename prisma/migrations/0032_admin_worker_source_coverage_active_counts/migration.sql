-- Spec §11 follow-up: track active source count + recently successful /
-- failed source counts per content type so the command center,
-- content-growth dashboard, and Developer Audit can show source health
-- (not just configured-source counts).

ALTER TABLE "AdminWorkerSourceCoverage"
  ADD COLUMN IF NOT EXISTS "activeSourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recentlySuccessfulSources" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recentlyFailedSources" INTEGER NOT NULL DEFAULT 0;
