import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonOk } from "@/lib/http";
import { runPublicGrowthRecovery } from "@/lib/diagnostics/public-growth-recovery";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

/**
 * Admin public growth recovery action. When the catalog has zero
 * strict-public rows and the worker is healthy, this repairs missing
 * source jobs and enqueues the growth bootstrap, then reports the
 * exact stage the pipeline is stuck at. Returns a JSON summary.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const report = await runPublicGrowthRecovery({ triggeredBy: "manual" });
  logger.info("admin.growth.recover.completed", {
    ranRecovery: report.ranRecovery,
    failingStage: report.failingStage,
  });
  return jsonOk({ report });
}
