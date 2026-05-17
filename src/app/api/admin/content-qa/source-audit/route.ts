import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getSourceAudit } from "@/lib/content-qa";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only source audit lookup. Returns the full health + quality
 * history of one IngestionSource so the admin can answer "why is
 * this source trusted or paused?" Backs the 10/10 audit
 * requirement.
 *
 * Query: ?source=vatican.va  (accepts either the source id or host)
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  const url = new URL(req.url);
  const sourceIdOrHost = url.searchParams.get("source");
  if (!sourceIdOrHost) {
    return jsonError("invalid", {
      message: "?source=<id-or-host> is required.",
    });
  }
  try {
    const audit = await getSourceAudit({ sourceIdOrHost });
    logger.info("admin.content_qa.source_audit.lookup", {
      actor: admin.username,
      sourceIdOrHost,
      found: audit.found,
      requestId,
    });
    return jsonOk({ requestId, audit });
  } catch (err) {
    return jsonError("server_error", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
