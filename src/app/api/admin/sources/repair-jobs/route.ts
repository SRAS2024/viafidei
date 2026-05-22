import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { ADMIN_ACTION, writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonOk } from "@/lib/http";
import { runSourceJobRepair } from "@/lib/ingestion/queue/source-job-repair";
import { logger } from "@/lib/observability/logger";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

export const dynamic = "force-dynamic";

/**
 * Admin "Repair source jobs" action. Enqueues a missing
 * source_discovery job for every factory-ready source that has zero
 * active queue jobs (paused / not_configured sources and per-source
 * daily caps are respected). Returns a JSON repair summary.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const report = await runSourceJobRepair({ triggeredBy: "manual" });
  logger.info("admin.sources.repair_jobs.completed", {
    factoryReadySources: report.factoryReadySources,
    sourcesWithZeroJobs: report.sourcesWithZeroJobs,
    discoveryJobsCreated: report.discoveryJobsCreated,
  });

  // Record the source job repair as an important admin action for the
  // Developer Audit report — a valid authenticated admin, no alert.
  await writeAdminActionLog({
    adminUsername: gate.admin.username,
    actionType: ADMIN_ACTION.sourceJobRepair,
    route: "/api/admin/sources/repair-jobs",
    method: "POST",
    result: "success",
    deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    metadata: {
      discoveryJobsCreated: report.discoveryJobsCreated,
      sourcesWithZeroJobs: report.sourcesWithZeroJobs,
    },
  });
  return jsonOk({ report });
}
