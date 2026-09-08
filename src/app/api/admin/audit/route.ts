import { type NextRequest } from "next/server";
import { jsonOk } from "@/lib/http";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { listAuditLogs } from "@/lib/data/audit-log";

export async function GET(req: NextRequest) {
  // The centralized gate is the one admin authorization path. On a GET its
  // CSRF stage is a no-op (safe method), so this read still gets exactly what
  // it needs: banned-device enforcement plus a completed-2FA admin session.
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

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
