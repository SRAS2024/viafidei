-- Idempotent backstop for the account email contract: User.emailVerifiedAt,
-- PasswordResetToken, and EmailVerificationToken. The original migration
-- 0003_backend_completion creates these, so on a healthy database this
-- migration is a no-op. On a database where 0003 was partially applied,
-- skipped, or rolled back without being recorded, this re-creates exactly
-- what the welcome / verify-email / forgot-password / reset-password routes
-- need before they can call Resend.
--
-- Every statement is `IF NOT EXISTS` so it can run safely on a database
-- where the tables / columns / indexes / constraints already exist.

-- 1. User.emailVerifiedAt — set when verify-email succeeds; the /profile
-- dashboard reads it to decide whether to show the resend button.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- 2. PasswordResetToken — written by forgot-password, consumed by
-- reset-password.
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
    ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
    ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
    ON "PasswordResetToken"("expiresAt");

-- ALTER TABLE ... ADD CONSTRAINT does NOT support `IF NOT EXISTS` in
-- Postgres, so wrap it in a DO block that checks pg_constraint first.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey'
    ) THEN
        ALTER TABLE "PasswordResetToken"
          ADD CONSTRAINT "PasswordResetToken_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. EmailVerificationToken — written by registration and the resend
-- verification route, consumed by verify-email.
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key"
    ON "EmailVerificationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx"
    ON "EmailVerificationToken"("userId");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx"
    ON "EmailVerificationToken"("expiresAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailVerificationToken_userId_fkey'
    ) THEN
        ALTER TABLE "EmailVerificationToken"
          ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
