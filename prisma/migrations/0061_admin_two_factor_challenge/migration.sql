-- @idempotent-recoverable
--
-- Pending second-factor challenge for the interactive admin sign-in
-- (security spec items 1 / 11).
--
-- Numbered 0061: 0057-0059 were claimed by concurrent security work and 0060
-- is the admin session store this table hangs off. Prisma applies migrations
-- in directory-name order and records them by name, so the gap is harmless.
--
-- WHY: a password alone now only produces a PENDING AdminSession row. This
-- table is the other half of the promotion gate — a row here is the only way
-- a PENDING session can ever become AUTHENTICATED.
--
-- WHAT IS NOT STORED: the six-digit code. `codeHash` is an HMAC-SHA256 under
-- the purpose-separated "admin-2fa" subkey, with the challenge id mixed in as
-- a per-row salt. The six-digit space is only 10^6, so an unkeyed digest
-- would be reversible from a database dump in microseconds; the keyed HMAC is
-- not, because the attacker also needs SESSION_SECRET.
--
-- `adminSessionHash` is likewise an HMAC of the pending session id, never the
-- id itself — the raw id exists only inside the encrypted session cookie.
--
-- Deploy safety: this file only creates a NEW table and its indexes, so no
-- statement can queue behind readers of a live table. lock_timeout is set
-- anyway so a pathological catalog lock fails fast rather than stalling
-- scripts/start.sh, which takes the site down on a non-zero exit.
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "AdminTwoFactorChallenge" (
    "id" TEXT NOT NULL,
    -- HMAC of the PENDING AdminSession id this challenge belongs to.
    "adminSessionHash" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    -- Keyed HMAC of the code. NEVER the code.
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    -- Set the moment a correct code is accepted: a challenge is single use.
    "consumedAt" TIMESTAMP(3),
    -- Set when a replacement challenge is issued (resend) or the attempt is
    -- abandoned: a superseded challenge can never be verified again.
    "supersededAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceCredentialHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

-- Verification and supersession both look the challenge up by the session it
-- belongs to; the cleanup lane sweeps by expiry.
CREATE INDEX IF NOT EXISTS "AdminTwoFactorChallenge_adminSessionHash_idx" ON "AdminTwoFactorChallenge"("adminSessionHash");
CREATE INDEX IF NOT EXISTS "AdminTwoFactorChallenge_expiresAt_idx" ON "AdminTwoFactorChallenge"("expiresAt");
