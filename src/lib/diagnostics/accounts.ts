import { prisma } from "@/lib/db/client";
import { checkAccountEmailDb } from "@/lib/email/db-health";
import {
  finalizeSection,
  runDiagnostic,
  startSection,
  type DiagnosticResult,
  type DiagnosticSection,
} from "./types";

/**
 * Per-table presence probe. Catches the case where one of the user-side
 * tables is missing (a migration was skipped) without trying to write to
 * it — the goal here is to know whether a real user action would have
 * succeeded.
 */
async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
      table,
    );
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

/**
 * Account diagnostics — purely read-only. The check fires real reads
 * against the user tables but never writes, so running it on a live
 * deployment cannot create test rows.
 */
export async function runAccountDiagnostics(): Promise<DiagnosticSection> {
  const shell = startSection("accounts", "Accounts");

  const results: DiagnosticResult[] = [];

  results.push(
    await runDiagnostic(
      "accounts.user_table",
      "User table reachable",
      shell.requestId,
      async () => {
        const total = await prisma.user.count();
        return {
          severity: "pass",
          summary: `${total} user rows.`,
          evidence: { total },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "accounts.profile_table",
      "Profile table reachable",
      shell.requestId,
      async () => {
        // Some installs may not yet have a Profile row for every user;
        // the route handlers create the row lazily. Surface counts only.
        const total = await prisma.profile.count();
        return {
          severity: "pass",
          summary: `${total} profile rows.`,
          evidence: { total },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "accounts.email_tokens",
      "Email + verification token tables present",
      shell.requestId,
      async () => {
        const check = await checkAccountEmailDb();
        if (!check.ok) {
          return {
            severity: "fail",
            summary: "One or more account-email tables are missing.",
            explanation:
              "Welcome / verify / forgot-password flows will fail before email is sent. " +
              "Run `prisma migrate deploy` or use the Ensure-Tables button.",
            evidence: {
              missing: check.pieces
                .filter((p) => !p.present)
                .map((p) => p.name)
                .join(", "),
            },
          };
        }
        return {
          severity: "pass",
          summary: "Account-email contract tables present.",
          evidence: { tablesChecked: check.pieces.length },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "accounts.saved_items",
      "Saved-item join tables present",
      shell.requestId,
      async () => {
        const tables = [
          "UserSavedPrayer",
          "UserSavedSaint",
          "UserSavedApparition",
          "UserSavedParish",
          "UserSavedDevotion",
        ];
        const presence = await Promise.all(tables.map((t) => tableExists(t)));
        const missing = tables.filter((_, i) => !presence[i]);
        if (missing.length > 0) {
          return {
            severity: "fail",
            summary: `Missing saved-item tables: ${missing.join(", ")}.`,
            explanation: "Save / unsave routes will throw on first call until the migration lands.",
          };
        }
        return {
          severity: "pass",
          summary: "All five saved-item join tables present.",
          evidence: { tables: tables.length },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "accounts.session_table",
      "Session table reachable",
      shell.requestId,
      async () => {
        const total = await prisma.session.count();
        return {
          severity: "pass",
          summary: `${total} session rows.`,
          evidence: { total },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "accounts.rate_limit",
      "Rate-limit table reachable",
      shell.requestId,
      async () => {
        const total = await prisma.rateLimitBucket.count();
        return {
          severity: "pass",
          summary: `${total} active rate-limit buckets.`,
          evidence: { total },
        };
      },
    ),
  );

  return finalizeSection(shell, results);
}
