import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonOk } from "@/lib/http";
import { runSourceJobRepair } from "@/lib/ingestion/queue/source-job-repair";
import { logger } from "@/lib/observability/logger";

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
  return jsonOk({ report });
}
