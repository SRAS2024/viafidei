-- @idempotent-recoverable
--
-- Server-side admin session store (security spec items 3 / 12).
--
-- Numbered 0060, not 0057: concurrent security work in this tree had already
-- claimed 0057-0059. The gap is intentional and harmless — prisma applies
-- migrations in directory-name order and records them by name.
--
-- WHY: an encrypted cookie that merely says role=ADMIN is a bearer token with
-- no server-side lifecycle. It cannot express "password verified but second
-- factor still outstanding", it cannot be revoked at sign-out, and it cannot
-- expire on idleness. This table is the authoritative record: requireAdmin()
-- trusts a request only when a row here is stage='AUTHENTICATED', unrevoked
-- and inside both its idle and absolute windows.
--
-- The primary key is an HMAC of the opaque session id that lives inside the
-- encrypted cookie — the raw id is never written to the database, so a dump
-- of this table cannot be replayed as a session.
--
-- Deploy safety: this file only creates a NEW table and its indexes, so no
-- statement can queue behind readers of a live table. lock_timeout is set
-- anyway so a pathological catalog lock fails fast instead of stalling
-- scripts/start.sh (which takes the site down on a non-zero exit).
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "AdminSession" (
    "id" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'PENDING',
    "authenticatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorVerifiedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "rotatedFromId" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceCredentialHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- Cleanup lane sweeps by expiry; the trust check reads by primary key only.
CREATE INDEX IF NOT EXISTS "AdminSession_absoluteExpiresAt_idx" ON "AdminSession"("absoluteExpiresAt");
CREATE INDEX IF NOT EXISTS "AdminSession_revokedAt_idx" ON "AdminSession"("revokedAt");
-- Revoking every live session for one admin (credential change, forced
-- sign-out everywhere) filters on this pair.
CREATE INDEX IF NOT EXISTS "AdminSession_adminUsername_stage_idx" ON "AdminSession"("adminUsername", "stage");
