import { prisma } from "../db/client";

/**
 * Structured runtime error capture, written to the ErrorLog table so
 * the monthly Error Report PDF (mailed to ADMIN_EMAIL on the last day
 * of each month) has a complete record of what failed.
 *
 * Severity ladder:
 *   - "warn"     — non-fatal, captured for the monthly report only.
 *   - "error"    — application-level error (default).
 *   - "critical" — server-level: uncaught exceptions, unhandled
 *     rejections, the global error boundary firing. The notification
 *     scheduler additionally sends a Critical Failure email for these.
 */
export type ErrorSeverity = "warn" | "error" | "critical";
export type ErrorSource =
  | "page"
  | "api"
  | "ingestion"
  | "scheduler"
  | "global"
  | "uncaught"
  | "security"
  | "other";

export type RecordErrorInput = {
  source: ErrorSource;
  kind: string;
  message: string;
  stack?: string;
  route?: string;
  requestId?: string;
  severity?: ErrorSeverity;
  context?: Record<string, unknown>;
};

export async function recordError(input: RecordErrorInput): Promise<void> {
  try {
    await prisma.errorLog.create({
      data: {
        source: input.source,
        kind: input.kind,
        message: (input.message ?? "").slice(0, 4000),
        stack: input.stack ? input.stack.slice(0, 8000) : null,
        route: input.route ?? null,
        requestId: input.requestId ?? null,
        severity: input.severity ?? "error",
        context: (input.context ?? null) as never,
      },
    });
  } catch {
    // Never throw from the error sink. If the database is unreachable
    // we already have bigger problems.
  }
}

export async function listErrorsBetween(start: Date, end: Date) {
  return prisma.errorLog.findMany({
    where: { occurredAt: { gte: start, lt: end } },
    orderBy: { occurredAt: "asc" },
  });
}

export async function countErrorsBetween(start: Date, end: Date): Promise<number> {
  return prisma.errorLog.count({
    where: { occurredAt: { gte: start, lt: end } },
  });
}

/**
 * Drop ErrorLog rows older than the retention window (default 90 days)
 * — the data is preserved in the per-month PDF that already shipped
 * by then, so we don't keep the structured copy forever.
 */
export async function pruneOldErrorLogs(olderThanDays = 90): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.errorLog.deleteMany({
    where: { occurredAt: { lt: cutoff } },
  });
  return result.count;
}
