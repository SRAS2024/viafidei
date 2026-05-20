import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getSevenDayGrowthReport } from "@/lib/data/seven-day-growth-report";
import { REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seven-day production content growth report — per-content-type
 * pipeline metrics, daily growth targets, 24h / 7d growth warnings,
 * the production growth score, and the four daily-trend charts.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const report = await getSevenDayGrowthReport().catch(() => null);
  return jsonOk({ report, requestId: req.headers.get(REQUEST_ID_HEADER) ?? null });
}
