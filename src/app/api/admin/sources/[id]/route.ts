import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { getIngestionSource, updateIngestionSource } from "@/lib/data/sources";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  baseUrl: z.string().url().max(500).optional(),
  sourceType: z.string().min(1).max(60).optional(),
  isOfficial: z.boolean().optional(),
  isActive: z.boolean().optional(),
  rateLimitPerMin: z.number().int().positive().max(10_000).nullish().optional(),
  notes: z.string().max(2000).nullish().optional(),
  reliabilityScore: z.number().min(0).max(1).nullish().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const source = await getIngestionSource(params.id);
  if (!source) return jsonError("not_found");
  return jsonOk({ source });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const limit = await rateLimit(`admin-sources:${admin.username}`, RATE_POLICIES.adminWrite);
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = patchSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const previous = await getIngestionSource(params.id);
  const result = await updateIngestionSource(params.id, parsed.data);
  if (!result.ok) return jsonError("not_found");

  await writeAudit({
    action: "admin.source.update",
    entityType: "IngestionSource",
    entityId: params.id,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    previousValue: previous as never,
    newValue: result.source as never,
  });
  return jsonOk({ source: result.source });
}
