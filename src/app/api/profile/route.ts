import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { getProfileForUser, updateProfile } from "@/lib/data/profile";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  languageOverride: z.string().max(20).nullable().optional(),
  theme: z.string().max(40).nullable().optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");
  const profile = await getProfileForUser(user.id);
  return jsonOk({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    profile,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`profile:${user.id}`, RATE_POLICIES.profileWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = patchSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await updateProfile(user.id, parsed.data);
  if (!result.ok) return jsonError("invalid", { message: result.reason });

  await writeAudit({
    action: "profile.update",
    entityType: "Profile",
    entityId: user.id,
    actorUsername: user.email,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: parsed.data as never,
  });
  return jsonOk({ profile: result.profile });
}
