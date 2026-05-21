import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonOk } from "@/lib/http";
import { processNextJob } from "@/lib/ingestion/queue/worker";
import { writeHeartbeat, removeHeartbeat } from "@/lib/ingestion/queue/heartbeat";
import { registerVaticanAdapters } from "@/lib/ingestion/sources";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

/** Hard cap so a debug pass can never run continuously inside the request. */
const RUN_ONCE_TIMEOUT_MS = 25_000;

/**
 * Admin "Run worker once" diagnostic. Triggers exactly ONE worker
 * pass against the queue inside the web request — never a continuous
 * loop, always under a timeout. This does NOT replace the Railway
 * worker; it is a debugging aid for confirming the queue drains.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const workerId = `admin-run-once-${Date.now()}`;
  const startedAt = new Date();

  // Probe that the worker code can write a heartbeat. status "stopped"
  // keeps this row from being counted as a live worker afterwards.
  let heartbeatWritten = false;
  try {
    await writeHeartbeat({
      workerId,
      startedAt,
      processedCount: 0,
      failedCount: 0,
      retryCount: 0,
      status: "stopped",
      processType: "worker",
    });
    heartbeatWritten = true;
  } catch (e) {
    logger.warn("admin.worker.run_once.heartbeat_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Workers need the adapter registry; registration is idempotent.
  try {
    registerVaticanAdapters();
  } catch {
    /* registry already populated */
  }

  let timedOut = false;
  let outcome: Awaited<ReturnType<typeof processNextJob>> | null = null;
  let errorMessage: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    outcome = await Promise.race([
      processNextJob(workerId),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error("run-once timed out"));
        }, RUN_ONCE_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  } finally {
    if (timer) clearTimeout(timer);
  }

  let failureReason: string | null = errorMessage;
  if (outcome?.processed && (outcome.result === "failed" || outcome.result === "retrying")) {
    const row = await prisma.ingestionJobQueue
      .findUnique({
        where: { id: outcome.job.id },
        select: { lastError: true, errorMessage: true },
      })
      .catch(() => null);
    failureReason = row?.lastError ?? row?.errorMessage ?? errorMessage ?? "unknown failure";
  }

  await removeHeartbeat(workerId).catch(() => undefined);

  const summary = {
    workerId,
    heartbeatWritten,
    timedOut,
    jobLeased: outcome?.processed ?? false,
    jobKind: outcome?.processed ? outcome.job.jobKind : null,
    jobName: outcome?.processed ? outcome.job.jobName : null,
    jobQueueId: outcome?.processed ? outcome.job.id : null,
    result: outcome?.processed ? outcome.result : null,
    completed: outcome?.processed ? outcome.result === "completed" : false,
    failed: outcome?.processed ? outcome.result === "failed" : false,
    failureReason,
  };
  logger.info("admin.worker.run_once.completed", summary);
  return jsonOk(summary);
}
