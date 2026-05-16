import { appConfig } from "@/lib/config";
import { readResendApiKey } from "@/lib/email/resend";
import { readAdminEmail } from "@/lib/email/admin-send";
import { checkAccountEmailDb } from "@/lib/email/db-health";
import {
  finalizeSection,
  runDiagnostic,
  startSection,
  type DiagnosticResult,
  type DiagnosticSection,
} from "./types";

/**
 * Email-side diagnostics:
 *
 *   - Is the Resend API key configured?
 *   - Is the canonical from-address set?
 *   - Is ADMIN_EMAIL set (so operational alerts have a destination)?
 *   - Do the account-email DB tables exist?
 *
 * No sensitive value (full key, DB URL) is ever included in any result
 * shape — the API key only shows up as a 4-character prefix + length.
 */
export async function runEmailDiagnostics(): Promise<DiagnosticSection> {
  const shell = startSection("email", "Email");

  const results: DiagnosticResult[] = [];

  results.push(
    await runDiagnostic("email.api_key", "Resend API key configured", shell.requestId, async () => {
      const apiKey = readResendApiKey();
      if (apiKey === null) {
        return {
          severity: "warn",
          summary: "No RESEND_API_KEY is set on this deployment.",
          explanation:
            "Welcome / verify / forgot-password emails are skipped at the transport layer. " +
            "Set RESEND_API_KEY in the hosting dashboard and redeploy.",
          evidence: { configured: false },
        };
      }
      return {
        severity: "pass",
        summary: "Resend API key present.",
        evidence: {
          configured: true,
          prefix: apiKey.slice(0, 4),
          length: apiKey.length,
        },
      };
    }),
  );

  results.push(
    await runDiagnostic(
      "email.admin_email",
      "Admin email address configured",
      shell.requestId,
      async () => {
        const admin = readAdminEmail();
        if (admin === null) {
          return {
            severity: "warn",
            summary: "No ADMIN_EMAIL is set on this deployment.",
            explanation:
              "Operational alerts (Biweekly Admin Report, Monthly Archive Cleaning Up, " +
              "monthly Error Report PDF, threshold milestones at 25/50/75/100%, Critical " +
              "Failure, Security Breach) are logged and skipped at the transport layer. " +
              "Set ADMIN_EMAIL in the hosting dashboard and redeploy.",
            evidence: { configured: false },
          };
        }
        return {
          severity: "pass",
          summary: `Admin notifications will be delivered to ${admin}.`,
          evidence: { configured: true, address: admin },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "email.from_address",
      "From address configured",
      shell.requestId,
      async () => {
        const from = appConfig.email.fromAddress;
        if (!from || !from.includes("@")) {
          return {
            severity: "fail",
            summary: "appConfig.email.fromAddress is missing or malformed.",
            explanation: "Check src/lib/config.ts — the from address is centralized there.",
          };
        }
        return {
          severity: "pass",
          summary: `Email will be sent from ${from}.`,
          evidence: { fromAddress: from, provider: appConfig.email.providerName },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "email.db_tables",
      "Account-email tables present",
      shell.requestId,
      async () => {
        const check = await checkAccountEmailDb();
        if (!check.ok) {
          return {
            severity: "fail",
            summary: "One or more required email tables are missing.",
            explanation:
              "Run `prisma migrate deploy` (or use the admin diagnostic's " +
              "Ensure-Tables button) so welcome / verify / forgot-password flows can write tokens.",
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
          summary: "All account-email tables exist.",
          evidence: { tablesChecked: check.pieces.length },
        };
      },
    ),
  );

  return finalizeSection(shell, results);
}
