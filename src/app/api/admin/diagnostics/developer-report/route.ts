/**
 * POST /api/admin/diagnostics/developer-report
 *
 * Generates the Developer Audit PDF server-side and returns it as a
 * downloadable file. The route:
 *   • requires a valid admin session (gateAdminApiCall — CSRF + banned
 *     device + admin auth); unauthenticated requests are rejected;
 *   • generates the PDF for the selected period entirely server-side;
 *   • logs that a developer audit report was generated, and records an
 *     AdminActionLog row — without raising a suspicious-activity alert,
 *     because the request is a valid authenticated admin action;
 *   • on failure, returns a redacted error naming the report source
 *     that failed, never a secret.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { ADMIN_ACTION, writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { jsonError, readJsonBody } from "@/lib/http";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { logger } from "@/lib/observability";
import { generateDeveloperReport } from "@/lib/diagnostics/developer-report";
import { redactString } from "@/lib/diagnostics/redaction";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  period: z.enum(["last-24-hours", "last-7-days", "month"]),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
    .optional(),
});

export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await readJsonBody<unknown>(req);
  if (!body.ok && body.reason === "too_large") {
    return jsonError("too_large");
  }
  const parsed = schema.safeParse(body.ok ? body.data : {});
  if (!parsed.success) {
    return jsonError("invalid", { details: parsed.error.flatten() });
  }

  const ipAddress = getClientIpOrNull(req);
  const userAgent = getUserAgent(req);
  const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;
  const startedAt = Date.now();

  const result = await generateDeveloperReport({
    period: parsed.data.period,
    month: parsed.data.month,
    adminUsername: admin.username,
  });

  if (!result.ok) {
    // Error state — tell the admin which report source failed, with
    // the message redacted so it can never expose a secret.
    const safeMessage = redactString(result.message);
    logger.warn("admin.developer_report.failed", {
      adminUsername: admin.username,
      period: parsed.data.period,
      month: parsed.data.month,
      failedSource: result.failedSource,
      durationMs: Date.now() - startedAt,
      success: false,
    });
    await writeAdminActionLog({
      adminUsername: admin.username,
      actionType: ADMIN_ACTION.developerReport,
      route: "/api/admin/diagnostics/developer-report",
      method: "POST",
      result: "failure",
      deviceCredential,
      ipAddress,
      userAgent,
      metadata: { period: parsed.data.period, failedSource: result.failedSource },
    });
    return jsonError("server_error", {
      message: `Developer Audit report could not be generated. Failed report source: ${result.failedSource}. ${safeMessage}`,
    });
  }

  // Report-generation log — admin username, time period, start/end,
  // generated timestamp, file size, success.
  logger.info("admin.developer_report.generated", {
    adminUsername: admin.username,
    period: result.period.label,
    periodType: result.period.type,
    startAt: result.period.startAt.toISOString(),
    endAt: result.period.endAt.toISOString(),
    generatedAt: result.generatedAt.toISOString(),
    fileSize: result.fileSize,
    durationMs: Date.now() - startedAt,
    success: true,
  });

  // A valid authenticated admin action — record it without any
  // suspicious-activity alert.
  await writeAdminActionLog({
    adminUsername: admin.username,
    actionType: ADMIN_ACTION.developerReport,
    route: "/api/admin/diagnostics/developer-report",
    method: "POST",
    result: "success",
    deviceCredential,
    ipAddress,
    userAgent,
    metadata: {
      period: result.period.label,
      periodType: result.period.type,
      startAt: result.period.startAt.toISOString(),
      endAt: result.period.endAt.toISOString(),
      fileSize: result.fileSize,
      fileName: result.fileName,
    },
  });
  await writeAudit({
    action: "admin.diagnostics.developer_report.generated",
    entityType: "DeveloperReport",
    entityId: result.period.type,
    actorUsername: admin.username,
    ipAddress,
    userAgent,
    newValue: {
      period: result.period.label,
      fileSize: result.fileSize,
      fileName: result.fileName,
    },
  });

  return new Response(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": String(result.fileSize),
      "Cache-Control": "no-store",
    },
  });
}
