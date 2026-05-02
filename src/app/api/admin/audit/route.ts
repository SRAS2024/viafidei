import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listAuditLogs } from "@/lib/data/audit-log";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const url = new URL(req.url);
  const result = await listAuditLogs({
    entityType: url.searchParams.get("entityType") ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    take: Number(url.searchParams.get("take")) || undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  return jsonOk(result);
}
