import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonOk } from "@/lib/http";
import { runQueueRepair } from "@/lib/ingestion/queue/queue-repair";
import { logger } from "@/lib/observability/logger";

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
  return jsonOk({ report });
}
