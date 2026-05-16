-- Add provenance fields to RejectedContentLog so the admin deleted-log
-- page can show which worker / ingestion batch produced each delete or
-- reject decision.
ALTER TABLE "RejectedContentLog"
  ADD COLUMN IF NOT EXISTS "workerJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "ingestionBatchId" TEXT;

CREATE INDEX IF NOT EXISTS "RejectedContentLog_workerJobId_idx"
  ON "RejectedContentLog" ("workerJobId");
CREATE INDEX IF NOT EXISTS "RejectedContentLog_ingestionBatchId_idx"
  ON "RejectedContentLog" ("ingestionBatchId");
