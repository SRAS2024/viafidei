-- Captures runtime errors for the monthly Error Report PDF.
CREATE TABLE IF NOT EXISTS "ErrorLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "requestId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "context" JSONB,
    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ErrorLog_occurredAt_idx" ON "ErrorLog" ("occurredAt");
CREATE INDEX IF NOT EXISTS "ErrorLog_severity_occurredAt_idx" ON "ErrorLog" ("severity", "occurredAt");

-- Tracks per-flow state for the admin notification scheduler (last
-- biweekly send, last monthly archive cleanup, threshold milestones
-- already notified per content type, last monthly error report).
CREATE TABLE IF NOT EXISTS "AdminNotificationState" (
    "id" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminNotificationState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminNotificationState_flow_key" ON "AdminNotificationState" ("flow");
