import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getContentReceipt } from "@/lib/diagnostics/content-receipt";
import { REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const url = new URL(req.url);
  const contentType = url.searchParams.get("contentType");
  const slug = url.searchParams.get("slug");
  if (!contentType || !slug) {
    return jsonError("invalid");
  }
  const receipt = await getContentReceipt({ contentType, slug });
  return jsonOk({ receipt, requestId: req.headers.get(REQUEST_ID_HEADER) ?? null });
}
