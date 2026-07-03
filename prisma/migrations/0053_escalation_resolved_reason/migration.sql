-- Escalation resolution awareness: record WHY an open escalation was closed so
-- the worker's self-monitoring knows when an issue is fixed. Two paths:
--   "condition_cleared"      — the warning is gone from the live assessment
--   "superseded_by_upgrade"  — a new build shipped (a code update may have fixed
--                              it; a still-broken issue re-escalates afresh under
--                              the new build SHA, since the SHA is in the dedup
--                              fingerprint).
-- Additive + nullable → backward-compatible; existing open rows read as NULL.

-- AlterTable
ALTER TABLE "AdminWorkerEscalation" ADD COLUMN "resolvedReason" TEXT;
