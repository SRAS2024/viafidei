/**
 * Structured Admin Worker logging. Wraps AdminWorkerLog writes so
 * callers can record events without re-stating the table schema.
 *
 * The logger is intentionally narrow — it writes to one table, in one
 * shape. No formatting, no levels-as-strings: every log row goes
 * through the typed AdminWorkerLogSeverity enum so the Developer Audit
 * PDF and the diagnostics card can group reliably.
 */

import type {
  AdminWorkerLogCategory,
  AdminWorkerLogSeverity,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { sampleWorkerEvent } from "./event-sampler";
import { workerExecutionOrigin } from "./execution-context";

export interface AdminWorkerLogInput {
  passId?: string | null;
  taskId?: string | null;
  severity?: AdminWorkerLogSeverity;
  category?: AdminWorkerLogCategory;
  eventName: string;
  message: string;
  contentType?: string | null;
  sourceHost?: string | null;
  sourceUrl?: string | null;
  relatedEntityId?: string | null;
  safeMetadata?: Prisma.InputJsonValue | null;
  /**
   * The caller already asked `sampleWorkerEvent` for this row (it needed the
   * `suppressed` count for the message). Set so the budget is not charged
   * twice for one written row.
   */
  presampled?: boolean;
}

/**
 * Stamp every log row with the runtime that produced it (spec §24: "logs
 * should indicate whether an operation was executed locally or by another
 * runtime"). Uses the existing `safeMetadata` column, so no schema change.
 */
function withExecutionOrigin(
  metadata: Prisma.InputJsonValue | null | undefined,
): Prisma.InputJsonValue {
  const origin = workerExecutionOrigin();
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return {
      ...(metadata as Record<string, unknown>),
      executedBy: origin,
    } as Prisma.InputJsonValue;
  }
  return (
    metadata == null ? { executedBy: origin } : { value: metadata, executedBy: origin }
  ) as Prisma.InputJsonValue;
}

/**
 * Write one AdminWorkerLog row — subject, for INFO rows, to the per-eventName
 * hourly budget in event-sampler.ts.
 *
 * The budget is enforced HERE rather than at the call sites because that is the
 * only place that covers every writer. Nine call sites opted in; the rest did
 * not, and `worker_lanes` (twice a pass) plus `build_ready_drain` (once a pass)
 * were writing ~720 INFO rows an hour against a budget of 120 — the same shape
 * as the events that produced ~1 M rows each in production. It is also what
 * makes the LOG_EVENT_SPAM repair real: `suppressWorkerEvent` used to mutate a
 * map that almost nobody read.
 *
 * Over-budget INFO rows are DROPPED, and the first drop of each cool-down
 * writes one WARN `log_event_sampled` row in its place so the ledger still
 * records that the event is being sampled. WARN/ERROR never sample.
 */
export async function writeAdminWorkerLog(
  prisma: PrismaClient,
  input: AdminWorkerLogInput,
): Promise<void> {
  const severity = input.severity ?? "INFO";
  if (severity === "INFO" && !input.presampled) {
    const decision = sampleWorkerEvent(input.eventName);
    if (!decision.write) {
      if (decision.suppressionStarted) {
        await writeAdminWorkerLog(prisma, {
          passId: input.passId ?? null,
          category: input.category,
          severity: "WARN",
          eventName: "log_event_sampled",
          message: `"${input.eventName}" exceeded its hourly INFO log budget and is being sampled; further rows are dropped until the cool-down expires.`,
          safeMetadata: { sampledEvent: input.eventName },
        }).catch(() => undefined);
      }
      return;
    }
  }
  await prisma.adminWorkerLog.create({
    data: {
      passId: input.passId ?? null,
      taskId: input.taskId ?? null,
      severity,
      category: input.category ?? "OVERVIEW",
      eventName: input.eventName,
      message: input.message,
      contentType: input.contentType ?? null,
      sourceHost: input.sourceHost ?? null,
      sourceUrl: input.sourceUrl ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      safeMetadata: withExecutionOrigin(input.safeMetadata),
    },
  });
}

export interface ListLogsOptions {
  category?: AdminWorkerLogCategory;
  severity?: AdminWorkerLogSeverity;
  contentType?: string;
  sourceHost?: string;
  taskType?: string;
  status?: string;
  since?: Date;
  until?: Date;
  passId?: string;
  taskId?: string;
  limit?: number;
}

export async function listAdminWorkerLogs(prisma: PrismaClient, opts: ListLogsOptions = {}) {
  return prisma.adminWorkerLog.findMany({
    where: {
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.severity ? { severity: opts.severity } : {}),
      ...(opts.contentType ? { contentType: opts.contentType } : {}),
      ...(opts.sourceHost ? { sourceHost: opts.sourceHost } : {}),
      ...(opts.passId ? { passId: opts.passId } : {}),
      ...(opts.taskId ? { taskId: opts.taskId } : {}),
      ...(opts.since || opts.until
        ? {
            createdAt: {
              ...(opts.since ? { gte: opts.since } : {}),
              ...(opts.until ? { lte: opts.until } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
  });
}

/**
 * Categories the spec calls out as filterable sections. Used by the
 * logs page and the Developer Audit UI to render section tabs.
 */
export const LOG_SECTIONS: ReadonlyArray<{ category: AdminWorkerLogCategory; label: string }> = [
  { category: "OVERVIEW", label: "Overview" },
  { category: "WORKER_PASS", label: "Worker passes" },
  { category: "SOURCE_DISCOVERY", label: "Source discovery" },
  { category: "SOURCE_READING", label: "Source reading" },
  { category: "CONTENT_CLASSIFICATION", label: "Content classification" },
  { category: "CONTENT_BUILD", label: "Content building" },
  { category: "VALIDATION", label: "Validation" },
  { category: "QA", label: "QA" },
  { category: "PUBLISHING", label: "Publishing" },
  { category: "POST_PUBLISH", label: "Post-publish verification" },
  { category: "HOMEPAGE", label: "Homepage" },
  { category: "CLEANUP", label: "Cleanup" },
  { category: "SECURITY", label: "Security" },
  { category: "REPORT", label: "Reports" },
  { category: "ERROR", label: "Errors" },
  { category: "REPAIR", label: "Repairs" },
];
