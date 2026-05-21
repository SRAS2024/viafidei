import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonOk } from "@/lib/http";
import { runStrictContentCleanup } from "@/lib/content-qa/cleanup";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin "Run strict cleanup and explain results" action. Runs the
 * strict content cleanup and returns the per-content-type summary
 * (rows inspected, made public-ready, marked unready, hard deleted)
 * so the admin can read exactly what happened. Every delete is
 * logged to RejectedContentLog with a reason by the cleanup engine.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const summary = await runStrictContentCleanup({
    sweepReason: "manual",
    triggeredBy: "manual",
    actorUsername: gate.admin.username,
  });
  logger.info("admin.content_qa.strict_cleanup.completed", {
    totalInspected: summary.totalInspected,
    totalFlaggedReady: summary.totalFlaggedReady,
    totalFlaggedUnready: summary.totalFlaggedUnready,
    totalHardDeleted: summary.totalHardDeleted,
  });
  return jsonOk({ summary });
}
