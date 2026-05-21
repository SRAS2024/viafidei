-- Developer Audit support — durable diagnostic history + admin action log.
--
-- DiagnosticSnapshot stores one row per diagnostic card every time the
-- admin Diagnostics panel is loaded or diagnostics are run, so the
-- Developer Audit report can show historical diagnostic snapshots for
-- any selected time period. Secrets are redacted before insert.
--
-- AdminActionLog stores one row per important admin action / sensitive
-- admin page visit. It records the request (who / route / method /
-- result) plus device / IP / user-agent HMAC fingerprints and
-- best-effort geo. Distinct from AdminAuditLog, which records
-- content-entity before/after values.

CREATE TABLE IF NOT EXISTS "DiagnosticSnapshot" (
  "id"              TEXT NOT NULL,
  "diagnosticKey"   TEXT NOT NULL,
  "diagnosticName"  TEXT NOT NULL,
  "status"          TEXT NOT NULL,
  "summary"         TEXT NOT NULL,
  "dataSource"      TEXT NOT NULL,
  "detailsJson"     JSONB,
  "suggestedAction" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosticSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiagnosticSnapshot_diagnosticKey_createdAt_idx"
  ON "DiagnosticSnapshot" ("diagnosticKey", "createdAt");
CREATE INDEX IF NOT EXISTS "DiagnosticSnapshot_createdAt_idx"
  ON "DiagnosticSnapshot" ("createdAt");
CREATE INDEX IF NOT EXISTS "DiagnosticSnapshot_status_createdAt_idx"
  ON "DiagnosticSnapshot" ("status", "createdAt");

CREATE TABLE IF NOT EXISTS "AdminActionLog" (
  "id"                TEXT NOT NULL,
  "adminUserId"       TEXT,
  "adminUsername"     TEXT NOT NULL,
  "actionType"        TEXT NOT NULL,
  "route"             TEXT,
  "method"            TEXT,
  "result"            TEXT NOT NULL,
  "deviceFingerprint" TEXT,
  "ipHash"            TEXT,
  "userAgentHash"     TEXT,
  "city"              TEXT,
  "region"            TEXT,
  "country"           TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson"      JSONB,
  CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminActionLog_createdAt_idx"
  ON "AdminActionLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AdminActionLog_actionType_createdAt_idx"
  ON "AdminActionLog" ("actionType", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminActionLog_adminUsername_createdAt_idx"
  ON "AdminActionLog" ("adminUsername", "createdAt");
