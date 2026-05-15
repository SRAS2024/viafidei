import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runIngestionDiagnostics, loadIngestionLiveSnapshot } from "@/lib/diagnostics";
import { getRecentActivityByAction } from "@/lib/data/data-management-log";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Diagnostic routes pull Node-only Prisma helpers; pin the runtime so a
// future edit can't accidentally route them through the edge bundle.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const [section, snapshot, actions24h] = await Promise.all([
    runIngestionDiagnostics(),
    loadIngestionLiveSnapshot().catch(() => null),
    getRecentActivityByAction(24).catch(() => ({}) as Record<string, number>),
  ]);
  logger.info("admin.diagnostics.ingestion.ran", {
    requestId: section.requestId,
    severity: section.severity,
    resultCount: section.results.length,
    actor: admin.username,
  });
  return jsonOk({
    section,
    snapshot,
    actions24h,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? section.requestId,
  });
}
