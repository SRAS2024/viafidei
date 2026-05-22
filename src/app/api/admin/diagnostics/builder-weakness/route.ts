import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import {
  getBuilderWeaknessReport,
  getBuilderWeaknessBreakdowns,
  getBuildLogDetail,
} from "@/lib/diagnostics/builder-weakness";
import { REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const [entries, breakdowns, detail] = await Promise.all([
    getBuilderWeaknessReport(),
    getBuilderWeaknessBreakdowns().catch(() => null),
    getBuildLogDetail().catch(() => null),
  ]);
  return jsonOk({
    entries,
    breakdowns,
    detail,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? null,
  });
}
