import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runCanaryBuilds } from "@/lib/content-factory";
import { REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const report = runCanaryBuilds();
  return jsonOk({ report, requestId: req.headers.get(REQUEST_ID_HEADER) ?? null });
}
