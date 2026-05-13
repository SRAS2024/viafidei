import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { publishAllPending } from "@/lib/data/publish-list";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const result = await publishAllPending();
  const total = Object.values(result).reduce((a, b) => a + b, 0);

  await writeAudit({
    action: "admin.publish_list.publish_all",
    entityType: "PublishList",
    entityId: "all",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: { total, ...result } as never,
  });

  return jsonOk({ total, ...result });
}
