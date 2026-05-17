import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { recordDataManagementLogs } from "@/lib/data/data-management-log";
import { prisma } from "@/lib/db/client";
import { enqueueJob, PRIORITY_NORMAL } from "@/lib/ingestion/queue/queue";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  sourceId: z.string().min(1).max(120),
});

/**
 * Re-enqueue every active ingestion job that belongs to a single source.
 * Admin-triggered reprocessing — the queued jobs go to the front of the
 * priority queue so an operator who clicks "reprocess this source" sees
 * results within the worker's idle-sleep interval (not at the next
 * scheduled tick).
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const jobs = await prisma.ingestionJob.findMany({
    where: { sourceId: parsed.data.sourceId, isActive: true },
  });
  const enqueued: string[] = [];
  for (const job of jobs) {
    const row = await enqueueJob({
      jobName: job.jobName,
      jobKind: "source_discovery",
      dedupeKey: `reprocess:${job.id}:${Date.now()}`,
      sourceId: job.sourceId,
      jobId: job.id,
      contentType: job.targetEntity,
      priority: PRIORITY_NORMAL,
      triggeredBy: "manual",
      actorUsername: admin.username,
      payload: {
        sourceId: job.sourceId,
        adapterKey: job.jobName,
        contentType: job.targetEntity,
        mode: "constant" as const,
      },
    });
    enqueued.push(row.id);
  }

  if (enqueued.length > 0) {
    await recordDataManagementLogs([
      {
        action: "ADD",
        contentType: "IngestionQueue",
        contentRef: parsed.data.sourceId,
        reason: `Manual source reprocess — enqueued ${enqueued.length} jobs`,
        triggeredBy: "manual",
        actorUsername: admin.username,
      },
    ]);
  }

  await writeAudit({
    action: "admin.ingestion.source.reprocess",
    entityType: "IngestionSource",
    entityId: parsed.data.sourceId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: { enqueued } as never,
  });
  return jsonOk({ enqueued });
}
