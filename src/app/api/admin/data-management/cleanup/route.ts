import { type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { logger } from "@/lib/observability";
import { enqueueJob, PRIORITY_CONTENT_THRESHOLD_UNMET } from "@/lib/ingestion/queue";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Admin-triggered "Run data cleanup now".
 *
 * Per the content-factory spec: this endpoint NEVER executes cleanup
 * inline anymore. It enqueues three high-priority cleanup jobs into
 * the durable queue and returns immediately. The worker picks them up
 * on its next iteration:
 *
 *   1. strict_cleanup        — runs the strict content QA cleanup
 *      pass (delete invalid + log).
 *   2. dedupe_cleanup        — collapses duplicate prayers / content.
 *   3. archive_cleanup       — purges archived rows past the
 *      retention window.
 *
 * The admin trigger is recorded in AdminAuditLog so the manual
 * action is traceable. The response carries the enqueued job ids so
 * the caller can poll their status on the queue page.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const started = Date.now();
  const settings = await getDataManagementSettings();
  let errorMessage: string | null = null;
  const enqueuedJobIds: string[] = [];

  try {
    const stamp = Date.now();
    const [strict, dedupe, archive] = await Promise.all([
      enqueueJob({
        jobName: "strict_cleanup_manual",
        jobKind: "strict_cleanup",
        dedupeKey: `manual_strict_cleanup_${stamp}`,
        priority: PRIORITY_CONTENT_THRESHOLD_UNMET,
        payload: { sweepReason: "manual" },
        triggeredBy: "manual",
        actorUsername: admin.username,
      }),
      enqueueJob({
        jobName: "dedupe_cleanup_manual",
        jobKind: "dedupe_cleanup",
        dedupeKey: `manual_dedupe_cleanup_${stamp}`,
        priority: PRIORITY_CONTENT_THRESHOLD_UNMET,
        payload: {},
        triggeredBy: "manual",
        actorUsername: admin.username,
      }),
      enqueueJob({
        jobName: "archive_cleanup_manual",
        jobKind: "archive_cleanup",
        dedupeKey: `manual_archive_cleanup_${stamp}`,
        priority: PRIORITY_CONTENT_THRESHOLD_UNMET,
        payload: { retentionDays: settings.hardDeleteAfterDays },
        triggeredBy: "manual",
        actorUsername: admin.username,
      }),
    ]);
    if (strict?.id) enqueuedJobIds.push(strict.id);
    if (dedupe?.id) enqueuedJobIds.push(dedupe.id);
    if (archive?.id) enqueuedJobIds.push(archive.id);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("admin.data_management.cleanup.enqueue_failed", {
      actor: admin.username,
      errorMessage,
    });
  }

  await writeAudit({
    action: "admin.data_management.cleanup.enqueue",
    entityType: "SiteSetting",
    entityId: "data_management",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: {
      enqueuedJobIds,
      hardDeleteAfterDays: settings.hardDeleteAfterDays,
      errorMessage,
    },
  });

  logger.info("admin.data_management.cleanup.enqueue", {
    actor: admin.username,
    durationMs: Date.now() - started,
    enqueuedJobIds,
    errorMessage,
  });

  if (errorMessage) {
    return jsonError("server_error", { message: errorMessage });
  }
  return jsonOk({
    durationMs: Date.now() - started,
    enqueuedJobIds,
    // Echo the legacy shape so the existing ManualCleanupRunButton UI
    // continues to show a sensible result; the inline counts are
    // always zero now because the actual cleanup work runs in the
    // worker.
    miscategorised: { totalArchived: 0, buckets: [] },
    duplicatePrayers: 0,
    hardDeleted: { totalDeleted: 0, buckets: [] },
    autoCleanupEnabled: settings.autoCleanupEnabled,
    hardDeleteAfterDays: settings.hardDeleteAfterDays,
    queued: true,
  });
}
