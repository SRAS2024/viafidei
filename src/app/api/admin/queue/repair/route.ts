import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { ADMIN_ACTION, writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonOk } from "@/lib/http";
import { runQueueRepair } from "@/lib/ingestion/queue/queue-repair";
import { logger } from "@/lib/observability/logger";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

export const dynamic = "force-dynamic";

/**
 * Admin "Repair queue" action. Recovers stale running jobs, releases
 * expired leases, and requeues retryable failed jobs — permanently
 * failed jobs (bad payload / removed job kind) are left alone.
 * Returns a JSON repair summary.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const report = await runQueueRepair();
  logger.info("admin.queue.repair.completed", {
    staleRunningJobsRecovered: report.staleRunningJobsRecovered,
    retryableFailedRequeued: report.retryableFailedRequeued,
    permanentlyFailedLeftAlone: report.permanentlyFailedLeftAlone,
  });

  // Record the queue repair as an important admin action for the
  // Developer Audit report — a valid authenticated admin, no alert.
  await writeAdminActionLog({
    adminUsername: gate.admin.username,
    actionType: ADMIN_ACTION.queueRepair,
    route: "/api/admin/queue/repair",
    method: "POST",
    result: "success",
    deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    metadata: {
      staleRunningJobsRecovered: report.staleRunningJobsRecovered,
      retryableFailedRequeued: report.retryableFailedRequeued,
    },
  });
  return jsonOk({ report });
}
