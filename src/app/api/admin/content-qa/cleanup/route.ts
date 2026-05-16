import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { runStrictContentCleanup } from "@/lib/content-qa";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { logger } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Admin-triggered "Run strict content QA cleanup". Scans every
 * PUBLISHED row in the catalog against its content-package contract:
 *   - Valid rows → flip publicRenderReady + isThresholdEligible = true.
 *   - Invalid rows → flip publicRenderReady = false + status = REVIEW.
 *   - Wrong-content rows (livestream / event / bulletin / news / press)
 *     → hard-delete with a RejectedContentLog row.
 *
 * Idempotent — re-running on a clean catalog is a no-op.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const started = Date.now();
  let summary: Awaited<ReturnType<typeof runStrictContentCleanup>> | null = null;
  let errorMessage: string | null = null;

  try {
    summary = await runStrictContentCleanup();
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("admin.content_qa.cleanup.failed", {
      actor: admin.username,
      errorMessage,
    });
  }

  await writeAudit({
    action: "admin.content_qa.cleanup.run",
    entityType: "ContentQA",
    entityId: "strict-cleanup",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: summary
      ? {
          totalInspected: summary.totalInspected,
          totalFlaggedReady: summary.totalFlaggedReady,
          totalFlaggedUnready: summary.totalFlaggedUnready,
          totalHardDeleted: summary.totalHardDeleted,
          errorMessage,
        }
      : { errorMessage },
  });

  logger.info("admin.content_qa.cleanup.run", {
    actor: admin.username,
    durationMs: Date.now() - started,
    totalInspected: summary?.totalInspected ?? 0,
    totalFlaggedReady: summary?.totalFlaggedReady ?? 0,
    totalFlaggedUnready: summary?.totalFlaggedUnready ?? 0,
    totalHardDeleted: summary?.totalHardDeleted ?? 0,
    errorMessage,
  });

  if (errorMessage) {
    return jsonError("server_error", { message: errorMessage });
  }
  return jsonOk({
    durationMs: Date.now() - started,
    summary,
  });
}
