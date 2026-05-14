-- DataManagementLog records every action by the Ingestion & Data
-- Management system. Idempotent (`IF NOT EXISTS`) so the migration can
-- be re-run safely.

CREATE TABLE IF NOT EXISTS "DataManagementLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentRef" TEXT,
    "reason" TEXT,
    "triggeredBy" TEXT NOT NULL DEFAULT 'automatic',
    "actorUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataManagementLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DataManagementLog_action_createdAt_idx"
  ON "DataManagementLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "DataManagementLog_contentType_createdAt_idx"
  ON "DataManagementLog"("contentType", "createdAt");
CREATE INDEX IF NOT EXISTS "DataManagementLog_createdAt_idx"
  ON "DataManagementLog"("createdAt");

-- Also add the two new index entries for AdminAuditLog that make the
-- by-actor and by-action queries fast.
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_createdAt_idx"
  ON "AdminAuditLog"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx"
  ON "AdminAuditLog"("action", "createdAt");
