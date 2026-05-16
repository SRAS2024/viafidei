import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/client";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  contentVersionId: z.string().min(1).max(120),
  decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
  notes: z.string().max(2000).optional(),
});

/**
 * Review workflow for major content updates affecting theology /
 * official documents / saints / sacraments / doctrinal material.
 * Writes a ContentReview row pointing at the underlying entity (the
 * one referenced by the ContentVersion) and flips the ContentVersion
 * `reviewRequired` flag off when the decision is APPROVED.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const version = await prisma.contentVersion.findUnique({
    where: { id: parsed.data.contentVersionId },
  });
  if (!version) return jsonError("not_found");

  await prisma.contentReview.create({
    data: {
      entityType: version.entityType,
      entityId: version.entityId,
      reviewerUsername: admin.username,
      decision: parsed.data.decision,
      notes: parsed.data.notes ?? null,
    },
  });

  if (parsed.data.decision === "APPROVED") {
    await prisma.contentVersion.update({
      where: { id: version.id },
      data: { reviewRequired: false },
    });
  }

  await writeAudit({
    action: "admin.content.version.review",
    entityType: version.entityType,
    entityId: version.entityId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: { decision: parsed.data.decision, contentVersionId: version.id } as never,
  });

  return jsonOk({ ok: true });
}
