import { type NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/client";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  jobId: z.string().min(1).max(120),
  action: z.enum(["pause", "resume"]),
  reason: z.string().max(240).optional(),
});

/**
 * Pause / resume a single ingestion job. The worker honors
 * `pausedAt` when it leases a queue row and skips the run with a
 * SKIPPED status, so paused jobs cost no retry attempts.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const isPause = parsed.data.action === "pause";
  await prisma.ingestionJob.update({
    where: { id: parsed.data.jobId },
    data: {
      pausedAt: isPause ? new Date() : null,
      pausedReason: isPause ? (parsed.data.reason ?? "Paused by admin") : null,
    },
  });
  await writeAudit({
    action: `admin.ingestion.job.${parsed.data.action}`,
    entityType: "IngestionJob",
    entityId: parsed.data.jobId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
  });
  return jsonOk({ ok: true });
}
