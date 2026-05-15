import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runAccountDiagnostics } from "@/lib/diagnostics";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const section = await runAccountDiagnostics();
  logger.info("admin.diagnostics.accounts.ran", {
    requestId: section.requestId,
    severity: section.severity,
    resultCount: section.results.length,
    actor: admin.username,
  });
  return jsonOk({ section, requestId: req.headers.get(REQUEST_ID_HEADER) ?? section.requestId });
}
