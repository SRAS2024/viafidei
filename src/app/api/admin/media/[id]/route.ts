import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonError, jsonOk } from "@/lib/http";
import { deleteMediaAsset, getMediaAsset } from "@/lib/data/media";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
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
