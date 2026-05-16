import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  buildTextPdfBase64,
  readAdminEmail,
  sendBiweeklyAdminReport,
  sendCriticalFailureAlert,
  sendMonthlyArchiveCleanupReport,
  sendMonthlyErrorReport,
  sendSecurityBreachAlert,
  sendThresholdMilestoneAlert,
  type AdminSendOutcome,
} from "@/lib/email";
import { isEmailConfigured } from "@/lib/email/resend";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger } from "@/lib/observability";
import { getClientIp, getUserAgent } from "@/lib/security/request";

/**
 * Admin email end-to-end diagnostics. Lets the operator trigger one
 * example of each admin notification flow and have it delivered to
 * ADMIN_EMAIL so they can verify the entire transport (template →
 * Resend → mailbox) works end-to-end. Every send uses obviously
 * fake / labeled "Diagnostic" data so the recipient knows it is a
 * test.
 *
 * Outputs the same `AdminSendOutcome` shape every admin sender
 * produces, so the diagnostic UI can render success / skipped /
 * failure identically across flows.
 */

const FLOWS = [
  "biweekly_report",
  "monthly_archive_cleanup",
  "monthly_error_report",
  "milestone_25",
  "milestone_50",
  "milestone_75",
  "milestone_final",
  "critical_failure",
  "security_breach",
] as const;
type Flow = (typeof FLOWS)[number];

const requestSchema = z.object({
  flow: z.enum(FLOWS),
});

async function dispatch(flow: Flow, requestId: string | null): Promise<AdminSendOutcome> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  switch (flow) {
    case "biweekly_report":
      return sendBiweeklyAdminReport(
        {
          Prayer: { added: 5, edited: 1, deleted: 0, archived: 2 },
          Saint: { added: 12, edited: 0, deleted: 0, archived: 0 },
          MarianApparition: { added: 1, edited: 0, deleted: 0, archived: 0 },
          Devotion: { added: 0, edited: 0, deleted: 0, archived: 0 },
          LiturgyEntry: { added: 3, edited: 2, deleted: 0, archived: 1 },
          SpiritualLifeGuide: { added: 0, edited: 0, deleted: 0, archived: 0 },
          Parish: { added: 47, edited: 6, deleted: 1, archived: 4 },
        },
        windowStart,
        now,
      );
    case "monthly_archive_cleanup": {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return sendMonthlyArchiveCleanupReport(
        {
          Prayer: 2,
          Saint: 0,
          MarianApparition: 0,
          Devotion: 1,
          LiturgyEntry: 0,
          SpiritualLifeGuide: 0,
          Parish: 5,
        },
        monthStart,
        monthEnd,
      );
    }
    case "monthly_error_report": {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const lines = [
        "Monthly Error Report — Diagnostic preview",
        `Generated: ${now.toISOString()}`,
        `Total errors in window: 3`,
        "",
        "---",
        "",
        "[2026-05-01T03:14:00.000Z] ERROR page.db_query",
        "  route: /prayers/hail-mary",
        "  message: Diagnostic example — Prisma timeout while reading prayer table",
        "",
        "[2026-05-09T11:42:13.000Z] WARN security.client_devtools_open",
        "  route: /admin",
        "  message: Diagnostic example — devtools detected on admin surface",
        "",
        "[2026-05-15T22:00:00.000Z] CRITICAL uncaught_exception",
        "  message: Diagnostic example — unhandled promise rejection in cron tick",
      ];
      const pdfBase64 = buildTextPdfBase64(
        `Error Report Diagnostic — ${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
        lines,
      );
      return sendMonthlyErrorReport({
        monthStart,
        monthEnd,
        totalErrors: 3,
        pdfBase64,
      });
    }
    case "milestone_25":
      return sendThresholdMilestoneAlert({
        contentLabel: "Prayers",
        threshold: 25,
        currentCount: 125,
        target: 500,
      });
    case "milestone_50":
      return sendThresholdMilestoneAlert({
        contentLabel: "Saints",
        threshold: 50,
        currentCount: 3500,
        target: 7000,
      });
    case "milestone_75":
      return sendThresholdMilestoneAlert({
        contentLabel: "Church Documents",
        threshold: 75,
        currentCount: 1125,
        target: 1500,
      });
    case "milestone_final":
      return sendThresholdMilestoneAlert({
        contentLabel: "Sacraments",
        threshold: 100,
        currentCount: 7,
        target: 7,
      });
    case "critical_failure":
      return sendCriticalFailureAlert({
        kind: "diagnostic_preview",
        message:
          "This is a diagnostic preview of the Critical Failure alert. No real failure has occurred.",
        context: {
          requestId: requestId ?? "diagnostic",
          source: "/api/admin/email/admin-test",
        },
      });
    case "security_breach":
      return sendSecurityBreachAlert({
        kind: "diagnostic_preview",
        summary:
          "This is a diagnostic preview of the Security Breach alert. No real breach has occurred.",
        ipAddress: "127.0.0.1",
        userAgent: "Via Fidei admin diagnostic",
        route: "/api/admin/email/admin-test",
        detail: {
          note: "Triggered by an admin from the /admin/diagnostics/email page.",
        },
      });
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const adminEmail = readAdminEmail();
  return jsonOk({
    configured: adminEmail !== null,
    adminEmail,
    resendConfigured: isEmailConfigured(),
    flows: FLOWS,
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const readResult = await readJsonBody(req);
  if (!readResult.ok) {
    return jsonError("invalid");
  }
  const parsed = requestSchema.safeParse(readResult.data);
  if (!parsed.success) {
    return jsonError("invalid");
  }

  const flow: Flow = parsed.data.flow;
  const requestId = req.headers.get("x-request-id");

  const adminEmail = readAdminEmail();
  if (!adminEmail) {
    return jsonOk({
      ok: true,
      delivery: "skipped",
      reason: "admin_email_not_set",
      flow,
    });
  }
  if (!isEmailConfigured()) {
    return jsonOk({
      ok: true,
      delivery: "skipped",
      reason: "email_not_configured",
      flow,
    });
  }

  const outcome = await dispatch(flow, requestId).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("admin.email.admin_test.dispatch_failed", { flow, error: message });
    return { ok: false as const, reason: message };
  });

  await writeAudit({
    action: "admin.email.admin_test",
    entityType: "AdminEmail",
    entityId: flow,
    actorUsername: admin.username,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    requestId: requestId ?? undefined,
    newValue: { flow, outcome },
  });

  logger.info("admin.email.admin_test.sent", {
    flow,
    adminEmail,
    outcome,
    requestId,
  });

  return jsonOk({ ...outcome, flow, adminEmail });
}
