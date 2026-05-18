import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getBuilderWeaknessReport } from "@/lib/diagnostics/builder-weakness";
import { REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const entries = await getBuilderWeaknessReport();
  return jsonOk({ entries, requestId: req.headers.get(REQUEST_ID_HEADER) ?? null });
}
