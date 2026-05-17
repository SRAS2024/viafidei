import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getSystemHealthReport } from "@/lib/content-qa";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only endpoint returning the seven system health scores in a
 * single payload:
 *
 *   - system            — minimum of the six components below.
 *   - contentQA         — cleanup freshness + delete-all-invalid + rejection rate.
 *   - durableQueue      — pending + retrying + oldest pending age.
 *   - sourceQuality     — active vs paused / failing / exhausted.
 *   - workerReliability — active vs stale heartbeats + queue depth.
 *   - thresholdGrowth   — strict valid counts vs configured targets.
 *   - publicRendering   — invalid public rows across every catalog table.
 *
 * Powers the Data Management Health panel and the
 * `/admin/diagnostics` page card grid. Every score includes
 * `hasQueryFailures` so a panel knows when one of the inputs failed
 * (so the dashboard can render a diagnostic error rather than a
 * misleading "100" or "0").
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  try {
    const report = await getSystemHealthReport();
    logger.info("admin.diagnostics.health_scores.ran", {
      actor: admin.username,
      requestId,
      systemScore: report.scores.system.score,
    });
    return jsonOk({ requestId, report });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("admin.diagnostics.health_scores.failed", {
      actor: admin.username,
      errorMessage,
    });
    return jsonError("server_error", { message: errorMessage });
  }
}
