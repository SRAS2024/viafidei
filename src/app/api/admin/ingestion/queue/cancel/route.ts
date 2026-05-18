import { type NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { cancelJob } from "@/lib/ingestion/queue";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  jobQueueId: z.string().min(1).max(120),
  reason: z.string().max(240).optional(),
});

/**
 * Cancel a pending / retrying / running queue row. Pending and
 * retrying rows are canceled immediately; running rows get a
 * `cancelRequestedAt` flag that the worker checks between batches.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await cancelJob(
    parsed.data.jobQueueId,
    parsed.data.reason ?? "Canceled by admin",
    admin.username,
  );
  if (!result.ok) {
    return jsonError("not_found", { message: result.status });
  }
  await writeAudit({
    action: "admin.ingestion.queue.cancel",
    entityType: "IngestionJobQueue",
    entityId: parsed.data.jobQueueId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: result as never,
  });
  return jsonOk({ result });
}
