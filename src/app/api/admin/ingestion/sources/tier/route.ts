import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/client";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  sourceId: z.string().min(1).max(120),
  newTier: z.number().int().min(1).max(3),
  reason: z.string().min(3).max(500),
});

/**
 * Change a source's trust tier. Requires admin + a non-empty reason
 * string; writes a `SourceTierChange` audit row and updates the
 * source's `tier` + `lastSourceTierChangeAt`.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const existing = await prisma.ingestionSource.findUnique({
    where: { id: parsed.data.sourceId },
  });
  if (!existing) return jsonError("not_found");

  await prisma.sourceTierChange.create({
    data: {
      sourceId: parsed.data.sourceId,
      previousTier: existing.tier,
      newTier: parsed.data.newTier,
      reason: parsed.data.reason,
      actorUsername: admin.username,
    },
  });
  await prisma.ingestionSource.update({
    where: { id: parsed.data.sourceId },
    data: {
      tier: parsed.data.newTier,
      lastSourceTierChangeAt: new Date(),
    },
  });
  await writeAudit({
    action: "admin.ingestion.source.tier_change",
    entityType: "IngestionSource",
    entityId: parsed.data.sourceId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    previousValue: { tier: existing.tier } as never,
    newValue: { tier: parsed.data.newTier, reason: parsed.data.reason } as never,
  });
  return jsonOk({
    ok: true,
    previousTier: existing.tier,
    newTier: parsed.data.newTier,
  });
}
