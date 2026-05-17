-- Security Event + Banned Device — durable two-tier security audit
-- trail.
--
-- SecurityEvent stores every Suspicious Activity / Security Breach
-- observation the security middleware emits. Only HMAC fingerprints
-- (not raw IP or device credential) are persisted.
--
-- BannedDevice stores the result of an admin clicking a signed ban
-- link from a Security Breach email. There is no admin UI to remove
-- rows — bans are permanent by design. Middleware reads
-- `active = true` rows on every request and blocks before any page
-- renders.

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  "id"                    TEXT NOT NULL,
  "eventType"             TEXT NOT NULL,
  "classification"        TEXT NOT NULL,
  "severity"              TEXT NOT NULL,
  "ipAddressHash"         TEXT,
  "deviceCredentialHash"  TEXT,
  "userAgentHash"         TEXT,
  "userAgent"             TEXT,
  "city"                  TEXT,
  "region"                TEXT,
  "country"               TEXT,
  "targetRoute"           TEXT,
  "httpMethod"            TEXT,
  "attemptedAction"       TEXT,
  "accountId"             TEXT,
  "adminAccount"          BOOLEAN NOT NULL DEFAULT FALSE,
  "requestId"             TEXT,
  "automaticActionTaken"  TEXT,
  "emailSent"             BOOLEAN NOT NULL DEFAULT FALSE,
  "banTokenIssued"        BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SecurityEvent_eventType_idx"
  ON "SecurityEvent" ("eventType");
CREATE INDEX IF NOT EXISTS "SecurityEvent_classification_idx"
  ON "SecurityEvent" ("classification");
CREATE INDEX IF NOT EXISTS "SecurityEvent_severity_idx"
  ON "SecurityEvent" ("severity");
CREATE INDEX IF NOT EXISTS "SecurityEvent_createdAt_idx"
  ON "SecurityEvent" ("createdAt");
CREATE INDEX IF NOT EXISTS "SecurityEvent_ipAddressHash_idx"
  ON "SecurityEvent" ("ipAddressHash");
CREATE INDEX IF NOT EXISTS "SecurityEvent_deviceCredentialHash_idx"
  ON "SecurityEvent" ("deviceCredentialHash");

CREATE TABLE IF NOT EXISTS "BannedDevice" (
  "id"                    TEXT NOT NULL,
  "deviceCredentialHash"  TEXT NOT NULL,
  "ipAddressHash"         TEXT,
  "userAgentHash"         TEXT,
  "firstSeenAt"           TIMESTAMP(3) NOT NULL,
  "lastSeenAt"            TIMESTAMP(3) NOT NULL,
  "banReason"             TEXT NOT NULL,
  "securityEventId"       TEXT,
  "createdBy"             TEXT NOT NULL,
  "active"                BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BannedDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BannedDevice_deviceCredentialHash_key"
  ON "BannedDevice" ("deviceCredentialHash");
CREATE INDEX IF NOT EXISTS "BannedDevice_active_idx"
  ON "BannedDevice" ("active");
CREATE INDEX IF NOT EXISTS "BannedDevice_ipAddressHash_idx"
  ON "BannedDevice" ("ipAddressHash");
CREATE INDEX IF NOT EXISTS "BannedDevice_createdAt_idx"
  ON "BannedDevice" ("createdAt");

-- BannedDevice.securityEventId references SecurityEvent.id. We use
-- SET NULL so deleting an old SecurityEvent does not cascade into
-- removing the BannedDevice row that still actively blocks traffic.
ALTER TABLE "BannedDevice"
  ADD CONSTRAINT "BannedDevice_securityEventId_fkey"
  FOREIGN KEY ("securityEventId") REFERENCES "SecurityEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Bind each session to the device credential cookie that issued it
-- so we can revoke every session for a banned device in a single
-- DELETE. Existing pre-migration rows stay NULL until the user
-- reauthenticates.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "deviceCredentialHash" TEXT;
CREATE INDEX IF NOT EXISTS "Session_deviceCredentialHash_idx"
  ON "Session" ("deviceCredentialHash");
