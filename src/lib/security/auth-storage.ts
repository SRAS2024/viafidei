/**
 * Read-only availability probe for the tables the account-recovery and
 * email-verification flows write to.
 *
 * WHY this exists: the account email flows used to repair their own schema
 * mid-request — a `relation does not exist` error triggered
 * `ensureAccountEmailTables()`, which issued table- and column-creating DDL
 * while handling an unauthenticated POST. That is schema mutation on an
 * attacker-reachable path: it needs a runtime database role holding DDL
 * rights, it takes schema locks on a live table under whatever concurrency
 * the caller can generate, and it silently papers over a broken deploy so
 * nobody ever fixes it.
 *
 * Schema creation belongs to the migration pipeline, which already owns it:
 * scripts/start.sh runs `prisma migrate deploy` (0003_backend_completion
 * defines these tables and 0006_ensure_account_email_tables re-asserts them
 * idempotently) and then scripts/validate-db.js, which refuses
 * to start the server unless PasswordResetToken and EmailVerificationToken
 * exist with their required columns. So by the time a request arrives, the
 * schema is either correct or the container never booted.
 *
 * What remains for request time is a *check*, not a repair: one read-only
 * catalog query, cached once it succeeds, so an auth route can fail closed
 * and report an operational problem instead of mutating the schema.
 */

import { prisma } from "@/lib/db/client";

/** Tables an account email flow cannot function without. */
export const REQUIRED_AUTH_TOKEN_TABLES = ["PasswordResetToken", "EmailVerificationToken"] as const;

export type AuthStorageStatus =
  | { ok: true }
  | { ok: false; reason: "missing_tables"; missing: string[] }
  | { ok: false; reason: "unreachable"; detail: string };

/**
 * Cached only on success. A healthy schema never loses a table under this
 * process, so one confirmation is enough; a failure is never cached, so a
 * deploy that repairs the database recovers without a restart.
 */
let confirmedHealthy = false;

/** Test seam — the module-level cache would otherwise leak across cases. */
export function resetAuthStorageProbeCache(): void {
  confirmedHealthy = false;
}

/**
 * Strip anything credential-shaped out of a driver error before it reaches
 * a log line. Prisma connection errors can carry the DATABASE_URL, which
 * embeds the database password.
 */
function redactDriverError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "unknown_error");
  return raw.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^\s/@]*@/g, "$1[redacted]@").slice(0, 200);
}

/**
 * Confirm the account-email token tables exist. Pure read — this function
 * must never issue DDL, and tests/security/no-ddl-in-auth.test.ts pins that
 * by scanning this file's own source.
 */
export async function checkAuthTokenStorage(): Promise<AuthStorageStatus> {
  if (confirmedHealthy) return { ok: true };
  let present: Set<string>;
  try {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN ('PasswordResetToken', 'EmailVerificationToken')`;
    present = new Set((rows ?? []).map((row) => row.tablename));
  } catch (error) {
    return { ok: false, reason: "unreachable", detail: redactDriverError(error) };
  }
  const missing = REQUIRED_AUTH_TOKEN_TABLES.filter((table) => !present.has(table));
  if (missing.length > 0) return { ok: false, reason: "missing_tables", missing };
  confirmedHealthy = true;
  return { ok: true };
}
