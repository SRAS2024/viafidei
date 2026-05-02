import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  schedule: z.string().max(120).nullish(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const limit = await rateLimit(`admin-ingestion:${admin.username}`, RATE_POLICIES.adminWrite);
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = patchSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const existing = await prisma.ingestionJob.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("not_found");

  const updated = await prisma.ingestionJob.update({
    where: { id: params.id },
    data: parsed.data,
  });

  await writeAudit({
    action: "admin.ingestion.job.update",
    entityType: "IngestionJob",
    entityId: params.id,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    previousValue: existing as never,
    newValue: updated as never,
  });
  return jsonOk({ job: updated });
}
