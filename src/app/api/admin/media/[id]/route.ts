import { type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonError, jsonOk } from "@/lib/http";
import { deleteMediaAsset, getMediaAsset } from "@/lib/data/media";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Gated like every other admin handler. A GET skips the CSRF stage on its
  // own (evaluateCsrf passes safe methods), but it must still enforce
  // banned devices and a completed-2FA session — which requireAdmin() alone
  // does not do.
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const asset = await getMediaAsset(id);
  if (!asset) return jsonError("not_found");
  return jsonOk({ asset });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const limit = await rateLimit(`admin-media:${admin.username}`, RATE_POLICIES.adminWrite);
  if (!limit.ok) return jsonError("rate_limited");

  const result = await deleteMediaAsset(id);
  if (!result.ok) return jsonError("not_found");

  await writeAudit({
    action: "admin.media.delete",
    entityType: "MediaAsset",
    entityId: id,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
  });
  return jsonOk({ deleted: true });
}
