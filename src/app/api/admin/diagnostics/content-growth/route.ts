import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getContentGrowthDashboard } from "@/lib/data/content-growth-dashboard";
import { getGlobalGrowthHealth } from "@/lib/data/growth-health-score";
import { REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const [rows, health] = await Promise.all([
    getContentGrowthDashboard().catch(() => []),
    getGlobalGrowthHealth().catch(() => null),
  ]);
  return jsonOk({ rows, health, requestId: req.headers.get(REQUEST_ID_HEADER) ?? null });
}
