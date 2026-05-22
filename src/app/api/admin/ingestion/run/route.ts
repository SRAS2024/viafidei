import { type NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { ADMIN_ACTION, writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { recordDataManagementLogs } from "@/lib/data/data-management-log";
import { ensureVaticanSchedule } from "@/lib/ingestion/sources";
import {
  enqueueJob,
  enqueueDueIngestionJobs,
  PRIORITY_CONTENT_THRESHOLD_UNMET,
} from "@/lib/ingestion/queue";
import { prisma } from "@/lib/db/client";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

const schema = z.object({
  jobName: z.string().min(1).max(120).optional(),
});

/**
 * Admin "run ingestion now" action. Always enqueues into the durable
 * queue at high priority so the worker picks the work up on its next
 * iteration. There is no direct-execution path anymore.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await readJsonBody<unknown>(req);
  const candidate = body.ok ? body.data : {};
  if (!body.ok && body.reason === "too_large") {
    return jsonError("too_large");
  }
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    return jsonError("invalid", { details: parsed.error.flatten() });
  }

  await ensureVaticanSchedule();

  let result: unknown;
  if (parsed.data.jobName) {
    const job = await prisma.ingestionJob.findFirst({
      where: { jobName: parsed.data.jobName, isActive: true },
    });
    if (!job) return jsonError("not_found", { message: "job-not-found" });
    const queued = await enqueueJob({
      jobName: job.jobName,
      jobKind: "source_discovery",
      dedupeKey: `manual:${job.id}:${Date.now()}`,
      sourceId: job.sourceId,
      jobId: job.id,
      contentType: job.targetEntity,
      priority: PRIORITY_CONTENT_THRESHOLD_UNMET,
      triggeredBy: "manual",
      actorUsername: admin.username,
      payload: {
        sourceId: job.sourceId,
        adapterKey: job.jobName,
        contentType: job.targetEntity,
        mode: "constant" as const,
      },
    });
    await recordDataManagementLogs([
      {
        action: "ADD",
        contentType: "IngestionQueue",
        contentRef: job.jobName,
        reason: "Manual run-now: enqueued at constant-mode priority",
        triggeredBy: "manual",
        actorUsername: admin.username,
      },
    ]);
    result = { enqueued: [queued.id] };
  } else {
    const summary = await enqueueDueIngestionJobs();
    await recordDataManagementLogs([
      {
        action: "ADD",
        contentType: "IngestionQueue",
        contentRef: "all-jobs",
        reason: `Manual planner run: enqueued ${summary.jobsEnqueued} jobs`,
        triggeredBy: "manual",
        actorUsername: admin.username,
      },
    ]);
    result = { plannerSummary: summary };
  }

  await writeAudit({
    action: parsed.data.jobName ? "admin.ingestion.run.job" : "admin.ingestion.run.all",
    entityType: "IngestionJob",
    entityId: parsed.data.jobName ?? "all",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: result as never,
  });

  // Record the ingestion trigger as an important admin action for the
  // Developer Audit report — a valid authenticated admin, no alert.
  await writeAdminActionLog({
    adminUsername: admin.username,
    actionType: ADMIN_ACTION.ingestionTriggered,
    route: "/api/admin/ingestion/run",
    method: "POST",
    result: "success",
    deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    metadata: { jobName: parsed.data.jobName ?? "all" },
  });

  return jsonOk({ result });
}
