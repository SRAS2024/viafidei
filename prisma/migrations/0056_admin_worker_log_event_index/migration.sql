-- The worker's own readers filter the ledger by event name over a recent
-- window (readiness: independent_verifiers in the last 7d; diagnostics and
-- the governor: brain_decided / stage_dispatched / governor_forced_stage
-- since a cutoff). Without this index each of those is a sequential scan of
-- a table that grows by ~35 rows per pass, and the hourly retention prune
-- added alongside it (cleanup.ts) walks the same (severity, createdAt) path.
-- Idempotent (single guarded CREATE INDEX), and certified re-runnable for
-- scripts/migrate-deploy.sh's P3009 self-heal: @idempotent-recoverable

CREATE INDEX IF NOT EXISTS "AdminWorkerLog_eventName_createdAt_idx"
  ON "AdminWorkerLog" ("eventName", "createdAt");
