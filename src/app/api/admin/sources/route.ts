import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { createIngestionSource, listIngestionSources } from "@/lib/data/sources";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  host: z.string().min(3).max(200),
  baseUrl: z.string().url().max(500),
  sourceType: z.string().min(1).max(60),
  isOfficial: z.boolean().optional(),
  isActive: z.boolean().optional(),
  rateLimitPerMin: z.number().int().positive().max(10_000).nullish(),
  notes: z.string().max(2000).nullish(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const sources = await listIngestionSources();
  return jsonOk({ sources });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const limit = await rateLimit(`admin-sources:${admin.username}`, RATE_POLICIES.adminWrite);
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = createSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await createIngestionSource(parsed.data);
  if (!result.ok) return jsonError("conflict", { message: result.reason });

  await writeAudit({
    action: "admin.source.create",
    entityType: "IngestionSource",
    entityId: result.source.id,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: result.source as never,
  });
  return jsonOk({ source: result.source });
}
