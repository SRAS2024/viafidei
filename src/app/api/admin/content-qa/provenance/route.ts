import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getRowProvenance } from "@/lib/content-qa";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only row provenance endpoint. Given `?contentType=Prayer&slug=hail-mary`
 * returns the catalog row's strict QA flags + the most recent
 * RejectedContentLog row (if any) for the same slug.
 *
 * This is the canonical "show your work" surface for the strict QA
 * system: it answers the 10/10 spec's audit questions —
 *   - Why does this row exist?
 *   - Which contract did it pass?
 *   - Why was it deleted (if it was)?
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  const url = new URL(req.url);
  const contentType = url.searchParams.get("contentType");
  const slug = url.searchParams.get("slug");
  if (!contentType || !slug) {
    return jsonError("invalid", {
      message: "Both `contentType` and `slug` query parameters are required.",
    });
  }
  try {
    const provenance = await getRowProvenance({ contentType, slug });
    logger.info("admin.content_qa.provenance.lookup", {
      actor: admin.username,
      contentType,
      slug,
      exists: provenance.exists,
      rejected: !!provenance.rejected,
      requestId,
    });
    return jsonOk({ requestId, provenance });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("admin.content_qa.provenance.failed", {
      actor: admin.username,
      contentType,
      slug,
      errorMessage,
    });
    return jsonError("server_error", { message: errorMessage });
  }
}
