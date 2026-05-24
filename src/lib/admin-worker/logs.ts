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
}

export async function writeAdminWorkerLog(
  prisma: PrismaClient,
  input: AdminWorkerLogInput,
): Promise<void> {
  await prisma.adminWorkerLog.create({
    data: {
      passId: input.passId ?? null,
      taskId: input.taskId ?? null,
      severity: input.severity ?? "INFO",
      category: input.category ?? "OVERVIEW",
      eventName: input.eventName,
      message: input.message,
      contentType: input.contentType ?? null,
      sourceHost: input.sourceHost ?? null,
      sourceUrl: input.sourceUrl ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      safeMetadata: input.safeMetadata ?? undefined,
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
