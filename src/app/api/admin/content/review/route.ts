import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { approveContent, rejectContent, requestRevision, moveToReview } from "@/lib/content/review";
import type { ReviewableEntityType } from "@/lib/content/types";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const ENTITY_TYPES: ReviewableEntityType[] = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Parish",
  "Devotion",
];

const schema = z.object({
  entityType: z.enum(ENTITY_TYPES as [ReviewableEntityType, ...ReviewableEntityType[]]),
  entityId: z.string().min(1).max(64),
  action: z.enum(["approve", "reject", "request-revision", "move-to-review"]),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const body = await readJsonBody(req);
  if (!body.ok) {
    return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  }
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError("invalid", { details: parsed.error.flatten() });
  }

  const args = {
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    actor: { username: admin.username },
    notes: parsed.data.notes ?? null,
  };

  const outcome =
    parsed.data.action === "approve"
      ? await approveContent(args)
      : parsed.data.action === "reject"
        ? await rejectContent(args)
        : parsed.data.action === "request-revision"
          ? await requestRevision(args)
          : await moveToReview(args);

  await writeAudit({
    action: `admin.content.review.${parsed.data.action}`,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: outcome as never,
  });

  if (!outcome.ok) {
    return jsonError("conflict", { message: outcome.reason });
  }
  return jsonOk({ outcome });
}
