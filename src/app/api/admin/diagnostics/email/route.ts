import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runEmailDiagnostics } from "@/lib/diagnostics";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Diagnostic routes pull Node-only Prisma / Resend helpers; keep them on
// the Node runtime so a future edit can't accidentally route them through
// the edge bundle.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const section = await runEmailDiagnostics();
  logger.info("admin.diagnostics.email.ran", {
    requestId: section.requestId,
    severity: section.severity,
    resultCount: section.results.length,
    actor: admin.username,
  });
  return jsonOk({ section, requestId: req.headers.get(REQUEST_ID_HEADER) ?? section.requestId });
}
