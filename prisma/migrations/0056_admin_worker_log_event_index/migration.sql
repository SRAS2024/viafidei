-- The worker's own readers filter the ledger by event name over a recent
-- window (readiness: independent_verifiers in the last 7d; diagnostics and
-- the governor: brain_decided / stage_dispatched / governor_forced_stage
-- since a cutoff). Without this index each of those is a sequential scan of
-- a table that grows by ~35 rows per pass, and the hourly retention prune
-- added alongside it (cleanup.ts) walks the same (severity, createdAt) path.
-- Idempotent (single guarded CREATE INDEX), and certified re-runnable for
-- scripts/migrate-deploy.sh's P3009 self-heal: @idempotent-recoverable

-- Bound the lock. CREATE INDEX takes SHARE on AdminWorkerLog, which conflicts
-- with the ROW EXCLUSIVE the Admin Worker holds on every ledger insert — and a
-- QUEUED lock request blocks the readers behind it, not just this statement.
-- Fail fast and let the deploy retry (the old container keeps serving) rather
-- than stalling reads of the live table. SET LOCAL scopes to the migration's
-- own transaction; deploy with the master switch OFF.
SET LOCAL lock_timeout = '5s';

CREATE INDEX IF NOT EXISTS "AdminWorkerLog_eventName_createdAt_idx"
  ON "AdminWorkerLog" ("eventName", "createdAt");
