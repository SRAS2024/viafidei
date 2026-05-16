import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { retryFailedJob } from "@/lib/ingestion/queue/queue";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  jobQueueId: z.string().min(1).max(120),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await retryFailedJob(parsed.data.jobQueueId, admin.username);
  if (!result) return jsonError("not_found", { message: "queue-row-not-failed-or-missing" });

  await writeAudit({
    action: "admin.ingestion.queue.retry",
    entityType: "IngestionJobQueue",
    entityId: parsed.data.jobQueueId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: result as never,
  });
  return jsonOk({ result });
}
