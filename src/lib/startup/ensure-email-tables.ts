import { prisma } from "../db/client";

/**
 * Runtime safety net for the account email contract.
 *
 * Every account email flow (welcome, resend verification, forgot
 * password, reset password) writes a row to `PasswordResetToken` or
 * `EmailVerificationToken` BEFORE calling Resend. If those tables are
 * missing, the route throws before email is ever attempted and the
 * user sees "we could not send the email at this time."
 *
 * The proper fix is `prisma migrate deploy`, which scripts/start.sh
 * runs at every container boot. This function is the belt-and-
 * suspenders fallback for environments where the migration pipeline
 * is bypassed (custom hosting startCommand, manual Node start without
 * start.sh, etc.) — it runs the same idempotent SQL the
 * 0006_ensure_account_email_tables migration runs, but on every app
 * boot from `instrumentation.ts`. Safe to call on a healthy database:
 * every statement is `IF NOT EXISTS` (or wrapped in a DO block that
 * checks pg_constraint first) so it does nothing when the tables are
 * already present.
 *
 * Returns a structured summary so the startup log line names exactly
 * which pieces it had to create.
 */
export type EnsureEmailTablesResult = {
  ok: boolean;
  created: string[];
  message?: string;
};

const STATEMENTS: ReadonlyArray<{ name: string; sql: string }> = [
  {
    name: "User.emailVerifiedAt column",
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);`,
  },
  {
    name: "PasswordResetToken table",
    sql: `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
    );`,
  },
  {
    name: "PasswordResetToken_tokenHash_key index",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
            ON "PasswordResetToken"("tokenHash");`,
  },
  {
    name: "PasswordResetToken_userId_idx index",
    sql: `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
            ON "PasswordResetToken"("userId");`,
  },
  {
    name: "PasswordResetToken_expiresAt_idx index",
    sql: `CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
            ON "PasswordResetToken"("expiresAt");`,
  },
  {
    name: "PasswordResetToken_userId_fkey foreign key",
    sql: `DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey'
            ) THEN
              ALTER TABLE "PasswordResetToken"
                ADD CONSTRAINT "PasswordResetToken_userId_fkey"
                FOREIGN KEY ("userId") REFERENCES "User"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;`,
  },
  {
    name: "EmailVerificationToken table",
    sql: `CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
    );`,
  },
  {
    name: "EmailVerificationToken_tokenHash_key index",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key"
            ON "EmailVerificationToken"("tokenHash");`,
  },
  {
    name: "EmailVerificationToken_userId_idx index",
    sql: `CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx"
            ON "EmailVerificationToken"("userId");`,
  },
  {
    name: "EmailVerificationToken_expiresAt_idx index",
    sql: `CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx"
            ON "EmailVerificationToken"("expiresAt");`,
  },
  {
    name: "EmailVerificationToken_userId_fkey foreign key",
    sql: `DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'EmailVerificationToken_userId_fkey'
            ) THEN
              ALTER TABLE "EmailVerificationToken"
                ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
                FOREIGN KEY ("userId") REFERENCES "User"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;`,
  },
];

async function tableExists(name: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
    name,
  )) as Array<unknown>;
  return rows.length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    table,
    column,
  )) as Array<unknown>;
  return rows.length > 0;
}

export async function ensureAccountEmailTables(): Promise<EnsureEmailTablesResult> {
  const created: string[] = [];

  // Snapshot what's missing BEFORE running the statements so the log
  // line can name the pieces this boot actually had to create. Every
  // statement is idempotent so running them all is harmless either
  // way; we only check existence to make the log accurate.
  let userVerifiedAtBefore = false;
  let passwordResetBefore = false;
  let emailVerificationBefore = false;
  try {
    const userTable = await tableExists("User");
    if (userTable) {
      userVerifiedAtBefore = await columnExists("User", "emailVerifiedAt");
    }
    passwordResetBefore = await tableExists("PasswordResetToken");
    emailVerificationBefore = await tableExists("EmailVerificationToken");
  } catch (error) {
    return {
      ok: false,
      created,
      message: `pre-check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  for (const stmt of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt.sql);
    } catch (error) {
      // Surface the failing piece so the operator log line names
      // exactly which statement threw — typically a permission issue
      // (the runtime DB role lacks CREATE TABLE) or a missing
      // upstream object (no User table to attach the FK to).
      return {
        ok: false,
        created,
        message: `${stmt.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Re-check after running. Anything that was missing before and is
  // present now is something we created.
  try {
    if (!userVerifiedAtBefore && (await columnExists("User", "emailVerifiedAt"))) {
      created.push("User.emailVerifiedAt");
    }
    if (!passwordResetBefore && (await tableExists("PasswordResetToken"))) {
      created.push("PasswordResetToken");
    }
    if (!emailVerificationBefore && (await tableExists("EmailVerificationToken"))) {
      created.push("EmailVerificationToken");
    }
  } catch {
    // Post-check failure doesn't invalidate the work — the statements
    // ran successfully. Just leave `created` as whatever we tracked.
  }

  return { ok: true, created };
}
