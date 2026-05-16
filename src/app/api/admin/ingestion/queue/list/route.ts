import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listQueueJobs, type QueueStatus } from "@/lib/ingestion/queue/queue";
import { jsonError, jsonOk } from "@/lib/http";

/**
 * Admin filter endpoint. Accepts query params:
 *   ?status=failed|skipped|retrying|completed|pending|running (comma-separated)
 *   ?contentType=Prayer|Saint|...
 *   ?sourceId=<id>
 *   ?needsReview=1
 *   ?take=<n>
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam
    ? (statusParam.split(",").filter(Boolean) as QueueStatus[])
    : undefined;
  const contentType = url.searchParams.get("contentType") ?? undefined;
  const sourceId = url.searchParams.get("sourceId") ?? undefined;
  const needsReview = url.searchParams.get("needsReview") === "1";
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;

  const rows = await listQueueJobs({
    status,
    contentType,
    sourceId,
    needsReview,
    take,
  });
  return jsonOk({ rows });
}
