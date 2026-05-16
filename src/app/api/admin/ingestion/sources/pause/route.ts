import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { pauseSource, resumeSource } from "@/lib/data/source-health";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  sourceId: z.string().min(1).max(120),
  action: z.enum(["pause", "resume"]),
  reason: z.string().max(240).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  if (parsed.data.action === "pause") {
    await pauseSource(
      parsed.data.sourceId,
      parsed.data.reason ?? "Paused by admin",
      admin.username,
    );
  } else {
    await resumeSource(parsed.data.sourceId);
  }

  await writeAudit({
    action: `admin.ingestion.source.${parsed.data.action}`,
    entityType: "IngestionSource",
    entityId: parsed.data.sourceId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
  });
  return jsonOk({ ok: true });
}
