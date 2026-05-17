import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import {
  runStrictContentCleanup,
  resolveCleanupPolicy,
  describeCleanupPolicy,
} from "@/lib/content-qa";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { logger } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Admin-triggered "Run strict content QA cleanup". Under the strict
 * production policy this scans every catalog row across every status
 * (PUBLISHED, REVIEW, DRAFT, ARCHIVED) and either:
 *
 *   - flips publicRenderReady + isThresholdEligible = true for rows
 *     that pass their package contract, OR
 *   - writes a RejectedContentLog row + deletes the row when it fails
 *     the contract.
 *
 * Idempotent — re-running on a clean catalog is a no-op.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const started = Date.now();
  const policy = resolveCleanupPolicy();
  let summary: Awaited<ReturnType<typeof runStrictContentCleanup>> | null = null;
  let errorMessage: string | null = null;

  try {
    summary = await runStrictContentCleanup({
      sweepReason: "manual",
      triggeredBy: "manual",
      actorUsername: admin.username,
    });
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
          totalLogFailures: summary.totalLogFailures,
          mode: summary.mode,
          deleteAllInvalid: summary.deleteAllInvalid,
          packageContractVersion: summary.packageContractVersion,
          errorMessage,
        }
      : { errorMessage },
  });

  logger.info("admin.content_qa.cleanup.run", {
    actor: admin.username,
    durationMs: Date.now() - started,
    mode: summary?.mode,
    deleteAllInvalid: summary?.deleteAllInvalid,
    totalInspected: summary?.totalInspected ?? 0,
    totalFlaggedReady: summary?.totalFlaggedReady ?? 0,
    totalFlaggedUnready: summary?.totalFlaggedUnready ?? 0,
    totalHardDeleted: summary?.totalHardDeleted ?? 0,
    totalLogFailures: summary?.totalLogFailures ?? 0,
    errorMessage,
  });

  if (errorMessage) {
    return jsonError("server_error", { message: errorMessage });
  }
  return jsonOk({
    durationMs: Date.now() - started,
    policy,
    policyLabel: describeCleanupPolicy(policy),
    summary,
  });
}
