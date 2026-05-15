import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runSitemapDiagnostics } from "@/lib/diagnostics";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { getPublicOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  // Use the same `getPublicOrigin` helper as the auth redirect path so
  // the reachability probes hit the host the user actually browsed to,
  // not the upstream localhost socket.
  const origin = getPublicOrigin(req);
  const section = await runSitemapDiagnostics(origin);
  logger.info("admin.diagnostics.sitemap.ran", {
    requestId: section.requestId,
    severity: section.severity,
    resultCount: section.results.length,
    actor: admin.username,
  });
  return jsonOk({
    section,
    origin,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? section.requestId,
  });
}
