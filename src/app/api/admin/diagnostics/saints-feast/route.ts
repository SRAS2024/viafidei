import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runSaintsFeastDiagnostics } from "@/lib/diagnostics";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const url = new URL(req.url);
  const monthRaw = Number(url.searchParams.get("month") ?? "");
  const dayRaw = Number(url.searchParams.get("day") ?? "");
  let target: Date | undefined;
  if (
    Number.isInteger(monthRaw) &&
    monthRaw >= 1 &&
    monthRaw <= 12 &&
    Number.isInteger(dayRaw) &&
    dayRaw >= 1 &&
    dayRaw <= 31
  ) {
    target = new Date(Date.UTC(new Date().getUTCFullYear(), monthRaw - 1, dayRaw));
  }

  const section = await runSaintsFeastDiagnostics(target);
  logger.info("admin.diagnostics.saints_feast.ran", {
    requestId: section.requestId,
    severity: section.severity,
    resultCount: section.results.length,
    actor: admin.username,
  });
  return jsonOk({
    section,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? section.requestId,
  });
}
