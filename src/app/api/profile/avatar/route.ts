import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { setProfileAvatar } from "@/lib/data/profile";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  mediaAssetId: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`avatar:${user.id}`, RATE_POLICIES.mediaUpload, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const profile = await setProfileAvatar(user.id, parsed.data.mediaAssetId);
  await writeAudit({
    action: "profile.avatar.set",
    entityType: "Profile",
    entityId: user.id,
    actorUsername: user.email,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: { mediaAssetId: parsed.data.mediaAssetId },
  });
  return jsonOk({ profile });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`avatar:${user.id}`, RATE_POLICIES.mediaUpload, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const profile = await setProfileAvatar(user.id, null);
  await writeAudit({
    action: "profile.avatar.clear",
    entityType: "Profile",
    entityId: user.id,
    actorUsername: user.email,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
  });
  return jsonOk({ profile });
}
