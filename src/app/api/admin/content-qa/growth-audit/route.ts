import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getGrowthAudit } from "@/lib/content-qa";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only content-type growth audit. Returns the 30-day timeline
 * of strict-valid count, adds, deletes, top contributing hosts, and
 * a status classification ("growing" / "stalled" / "shrinking" /
 * "complete") with a human-readable explanation. Backs the 10/10
 * audit requirement: "why is each content type growing or stalled?"
 *
 * Query: ?contentType=Prayer
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  const url = new URL(req.url);
  const contentType = url.searchParams.get("contentType");
  if (!contentType) {
    return jsonError("invalid", {
      message: "?contentType=<TypeName> is required.",
    });
  }
  try {
    const audit = await getGrowthAudit({ contentType });
    logger.info("admin.content_qa.growth_audit.lookup", {
      actor: admin.username,
      contentType,
      status: audit.status,
      requestId,
    });
    return jsonOk({ requestId, audit });
  } catch (err) {
    return jsonError("server_error", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
