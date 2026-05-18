import { type NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { pauseContentType, resumeContentType } from "@/lib/data/content-type-pause";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  contentType: z.enum([
    "Prayer",
    "Saint",
    "MarianApparition",
    "Devotion",
    "LiturgyEntry",
    "SpiritualLifeGuide",
    "Parish",
  ]),
  action: z.enum(["pause", "resume"]),
  reason: z.string().max(240).optional(),
});

/**
 * Pause / resume ingestion for a single content type across every
 * source. The worker checks `ContentTypePause` before leasing and
 * marks paused content-type rows SKIPPED so no retry budget is spent.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  if (parsed.data.action === "pause") {
    await pauseContentType(
      parsed.data.contentType,
      parsed.data.reason ?? "Paused by admin",
      admin.username,
    );
  } else {
    await resumeContentType(parsed.data.contentType);
  }

  await writeAudit({
    action: `admin.ingestion.content_type.${parsed.data.action}`,
    entityType: "ContentType",
    entityId: parsed.data.contentType,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
  });
  return jsonOk({ ok: true });
}
