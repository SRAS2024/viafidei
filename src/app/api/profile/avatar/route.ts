import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { setProfileAvatar, setProfileAvatarFromDataUrl } from "@/lib/data/profile";
import { writeAudit } from "@/lib/audit";
import { validateAvatarDataUrl, MAX_AVATAR_DATA_URL_BYTES } from "@/lib/media/avatar-data-url";

/**
 * Two ways to set the avatar:
 *   - `dataUrl`: client-optimized image (the auto-save path used by the
 *     profile UI). The route validates and persists it as a MediaAsset.
 *   - `mediaAssetId`: link to an already-stored MediaAsset (used by the
 *     admin tools when a curated image is selected from the library).
 */
const schema = z
  .object({
    mediaAssetId: z.string().min(1).max(64).optional(),
    dataUrl: z.string().min(32).optional(),
  })
  .refine((value) => Boolean(value.mediaAssetId || value.dataUrl), {
    message: "mediaAssetId or dataUrl is required",
  });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`avatar:${user.id}`, RATE_POLICIES.mediaUpload, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  // The data URL path can carry a compressed image up to ~350 KB; the JSON
  // body limit needs headroom for the base64 envelope and field names.
  const body = await readJsonBody(req, { limitBytes: MAX_AVATAR_DATA_URL_BYTES * 2 + 4 * 1024 });
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  let profile;
  let auditNew: Record<string, unknown> = {};

  if (parsed.data.dataUrl) {
    const validation = validateAvatarDataUrl(parsed.data.dataUrl);
    if (!validation.ok) {
      return jsonError(validation.reason === "too_large" ? "too_large" : "invalid", {
        message: validation.reason,
      });
    }
    const result = await setProfileAvatarFromDataUrl(user.id, validation);
    profile = result.profile;
    auditNew = {
      mediaAssetId: result.profile.avatarMediaId,
      mimeType: validation.mimeType,
      bytes: validation.byteLength,
    };
  } else if (parsed.data.mediaAssetId) {
    profile = await setProfileAvatar(user.id, parsed.data.mediaAssetId);
    auditNew = { mediaAssetId: parsed.data.mediaAssetId };
  } else {
    return jsonError("invalid");
  }

  await writeAudit({
    action: "profile.avatar.set",
    entityType: "Profile",
    entityId: user.id,
    actorUsername: user.email,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: auditNew,
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
