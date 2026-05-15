import { appConfig } from "../config";
import { prisma } from "../db/client";
import {
  CONTENT_TYPE_ROWS,
  buildTextPdfBase64,
  readAdminEmail,
  sendBiweeklyAdminReport,
  sendCriticalFailureAlert,
  sendMonthlyArchiveCleanupReport,
  sendMonthlyErrorReport,
  sendSecurityBreachAlert,
  sendThresholdMilestoneAlert,
  type AdminSendOutcome,
  type ContentManagementCounts,
} from "../email";
import { logger } from "../observability/logger";
import {
  CHURCH_DOCUMENT_SLUG_PREFIXES,
  CONSECRATION_SLUG_PREFIXES,
  SACRAMENT_SLUG_PREFIXES,
} from "../ingestion/backlog-prefixes";
import {
  getFlowState,
  setFlowState,
  type BiweeklyState,
  type MilestoneState,
  type MonthlySendState,
} from "./admin-notification-state";
import { countErrorsBetween, listErrorsBetween } from "./error-log";

/**
 * Converts a Date to its UTC year-month tag (e.g. "2026-05"). Used as
 * the bucket key for the monthly send dedup state.
 */
function yearMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** UTC midnight at the start of `d`'s month. */
function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** UTC midnight at the start of the month after `d`. */
function nextMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/**
 * Returns true when `now` is on the last calendar day (UTC) of its month —
 * the 30th in 30-day months, the 31st in 31-day months, the 28th or 29th
 * in February depending on the year. Used by both the monthly archive
 * cleanup digest and the monthly Error Report PDF so the two emails go
 * out on the same cadence with the same date semantics.
 */
export function isLastDayOfMonth(now: Date): boolean {
  const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return next.getUTCMonth() !== now.getUTCMonth();
}

/** ISO 14-day window relative to `now`. */
function biweeklyWindow(now: Date): { windowStart: Date; windowEnd: Date } {
  const windowEnd = new Date(now.getTime());
  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
}

/**
 * Aggregate per-action, per-contentType counts from DataManagementLog
 * over the supplied window. Mapping:
 *   - ADD          → added
 *   - UPDATE       → edited
 *   - DELETE       → deleted (hard delete via the cleanup pass; explicit
 *                    admin deletes also land here)
 *   - PURGE        → also folded into deleted (the cleanup pass writes
 *                    PURGE for hard deletes after the archive window)
 *   - CLEANUP      → archived
 */
async function aggregateContentManagementCounts(
  windowStart: Date,
  windowEnd: Date,
): Promise<ContentManagementCounts> {
  const rows = await prisma.dataManagementLog.groupBy({
    by: ["action", "contentType"],
    where: { createdAt: { gte: windowStart, lt: windowEnd } },
    _count: { _all: true },
  });
  const counts: ContentManagementCounts = {};
  for (const row of CONTENT_TYPE_ROWS) {
    counts[row.key] = { added: 0, edited: 0, deleted: 0, archived: 0 };
  }
  for (const row of rows) {
    if (!counts[row.contentType]) {
      counts[row.contentType] = { added: 0, edited: 0, deleted: 0, archived: 0 };
    }
    const target = counts[row.contentType];
    const n = row._count?._all ?? 0;
    switch (row.action) {
      case "ADD":
        target.added += n;
        break;
      case "UPDATE":
        target.edited += n;
        break;
      case "DELETE":
      case "PURGE":
        target.deleted += n;
        break;
      case "CLEANUP":
        target.archived += n;
        break;
      default:
        break;
    }
  }
  return counts;
}

/**
 * Aggregate the monthly cleanup totals — count of PURGE actions per
 * contentType during the calendar month. This is what the Monthly
 * Archive Cleaning Up email reports.
 */
async function aggregateMonthlyArchiveCounts(
  windowStart: Date,
  windowEnd: Date,
): Promise<Record<string, number>> {
  const rows = await prisma.dataManagementLog.groupBy({
    by: ["contentType"],
    where: {
      action: "PURGE",
      createdAt: { gte: windowStart, lt: windowEnd },
    },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of CONTENT_TYPE_ROWS) {
    out[row.key] = 0;
  }
  for (const row of rows) {
    out[row.contentType] = (out[row.contentType] ?? 0) + (row._count?._all ?? 0);
  }
  return out;
}

/**
 * Decide whether the biweekly report is due. Send when:
 *   - There has never been a send (lastSentAt missing), OR
 *   - It has been ≥ 14 days since the last successful send.
 */
async function maybeSendBiweeklyReport(now: Date): Promise<AdminSendOutcome | null> {
  const state = await getFlowState<BiweeklyState>("biweekly_report");
  const lastSent = state ? new Date(state.lastSentAt) : null;
  const ageMs = lastSent ? now.getTime() - lastSent.getTime() : Number.POSITIVE_INFINITY;
  if (ageMs < 14 * 24 * 60 * 60 * 1000) return null;

  const { windowStart, windowEnd } = biweeklyWindow(now);
  const counts = await aggregateContentManagementCounts(windowStart, windowEnd);
  const result = await sendBiweeklyAdminReport(counts, windowStart, windowEnd);
  if (result.ok && result.delivery === "sent") {
    await setFlowState<BiweeklyState>("biweekly_report", {
      lastSentAt: now.toISOString(),
    });
  }
  return result;
}

/**
 * Monthly archive cleanup email: sent on the last day of every month
 * (30th / 31st / final-of-Feb). One send per calendar month.
 */
async function maybeSendMonthlyArchiveCleanup(now: Date): Promise<AdminSendOutcome | null> {
  if (!isLastDayOfMonth(now)) return null;
  const tag = yearMonth(now);
  const state = await getFlowState<MonthlySendState>("monthly_archive_cleanup");
  if (state && state.lastSentYearMonth === tag) return null;

  const wStart = monthStart(now);
  const wEnd = nextMonthStart(now);
  const counts = await aggregateMonthlyArchiveCounts(wStart, wEnd);
  const result = await sendMonthlyArchiveCleanupReport(counts, wStart, wEnd);
  if (result.ok && result.delivery === "sent") {
    await setFlowState<MonthlySendState>("monthly_archive_cleanup", {
      lastSentYearMonth: tag,
    });
  }
  return result;
}

/**
 * Build the monthly Error Report PDF and email it as an attachment.
 * Same last-day-of-month timing as the archive cleanup email.
 */
async function maybeSendMonthlyErrorReport(now: Date): Promise<AdminSendOutcome | null> {
  if (!isLastDayOfMonth(now)) return null;
  const tag = yearMonth(now);
  const state = await getFlowState<MonthlySendState>("monthly_error_report");
  if (state && state.lastSentYearMonth === tag) return null;

  const wStart = monthStart(now);
  const wEnd = nextMonthStart(now);
  const total = await countErrorsBetween(wStart, wEnd);
  const errors = await listErrorsBetween(wStart, wEnd);

  const lines: string[] = [];
  lines.push(`Monthly error report for ${tag}`);
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push(`Total errors: ${total}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  if (errors.length === 0) {
    lines.push("No errors were logged during this period.");
  } else {
    for (const e of errors) {
      lines.push(
        `[${e.occurredAt.toISOString()}] ${e.severity.toUpperCase()} ${e.source}.${e.kind}`,
      );
      if (e.route) lines.push(`  route: ${e.route}`);
      if (e.requestId) lines.push(`  requestId: ${e.requestId}`);
      lines.push(`  message: ${e.message}`);
      if (e.stack) {
        const head = e.stack.split("\n").slice(0, 5).join(" | ");
        lines.push(`  stack: ${head}`);
      }
      lines.push("");
    }
  }
  const pdfBase64 = buildTextPdfBase64(`Error Report — ${tag}`, lines);
  const result = await sendMonthlyErrorReport({
    monthStart: wStart,
    monthEnd: wEnd,
    totalErrors: total,
    pdfBase64,
  });
  if (result.ok && result.delivery === "sent") {
    await setFlowState<MonthlySendState>("monthly_error_report", {
      lastSentYearMonth: tag,
    });
  }
  return result;
}

/**
 * Per-content-type milestone tracking. We watch the same six buckets
 * the ingestion scheduler tracks against `appConfig.ingestion.targets`,
 * and the friendly labels matching the Content Management Report rows.
 */
type MilestoneBucket = {
  /** Stable key used in the milestone state row (one row per bucket). */
  key: string;
  /** Friendly content-type label rendered in the email subject + body. */
  label: string;
  /** Configured target from appConfig.ingestion.targets. */
  target: number;
  /** Live count from the database. */
  countFn: () => Promise<number>;
};

function buildPrefixWhere(prefixes: readonly string[]) {
  return { OR: prefixes.map((p) => ({ slug: { startsWith: p } })) };
}

function milestoneBuckets(): MilestoneBucket[] {
  const targets = appConfig.ingestion.targets;
  return [
    {
      key: "prayers",
      label: "Prayers",
      target: targets.prayers,
      countFn: () => prisma.prayer.count(),
    },
    {
      key: "saints",
      label: "Saints",
      target: targets.saints,
      countFn: () => prisma.saint.count(),
    },
    {
      key: "parishes",
      label: "Parishes",
      target: targets.parishes,
      countFn: () => prisma.parish.count(),
    },
    {
      key: "churchDocuments",
      label: "Church Documents",
      target: targets.churchDocuments,
      countFn: () =>
        prisma.liturgyEntry.count({
          where: buildPrefixWhere(CHURCH_DOCUMENT_SLUG_PREFIXES),
        }),
    },
    {
      key: "sacraments",
      label: "Sacraments",
      target: targets.sacraments,
      countFn: () =>
        prisma.spiritualLifeGuide.count({
          where: buildPrefixWhere(SACRAMENT_SLUG_PREFIXES),
        }),
    },
    {
      key: "consecrations",
      label: "Consecrations",
      target: targets.consecrations,
      countFn: () =>
        prisma.spiritualLifeGuide.count({
          where: buildPrefixWhere(CONSECRATION_SLUG_PREFIXES),
        }),
    },
  ];
}

const MILESTONE_THRESHOLDS: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];

/**
 * Cross-check every milestone bucket against its target and emit one
 * email per newly-crossed threshold. State is per-bucket so the same
 * threshold is never re-sent — even if the count later drops below it.
 */
export async function processMilestoneNotifications(): Promise<{
  sent: Array<{ bucket: string; threshold: number }>;
}> {
  const sent: Array<{ bucket: string; threshold: number }> = [];
  for (const bucket of milestoneBuckets()) {
    const flow = `milestone:${bucket.key}` as const;
    const state = (await getFlowState<MilestoneState>(flow)) ?? { sent: [] };
    let count = 0;
    try {
      count = await bucket.countFn();
    } catch {
      continue;
    }
    if (bucket.target <= 0) continue;
    const percent = (count / bucket.target) * 100;
    let dirty = false;
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (state.sent.includes(threshold)) continue;
      if (percent >= threshold) {
        try {
          const result = await sendThresholdMilestoneAlert({
            contentLabel: bucket.label,
            threshold,
            currentCount: count,
            target: bucket.target,
          });
          if (result.ok) {
            state.sent.push(threshold);
            dirty = true;
            sent.push({ bucket: bucket.key, threshold });
          }
        } catch (e) {
          logger.error("admin.milestone.send_failed", {
            bucket: bucket.key,
            threshold,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
    if (dirty) {
      await setFlowState<MilestoneState>(flow, state);
    }
  }
  return { sent };
}

export type AdminNotificationDispatchSummary = {
  biweekly: AdminSendOutcome | null;
  monthlyArchive: AdminSendOutcome | null;
  monthlyErrorReport: AdminSendOutcome | null;
  milestonesSent: Array<{ bucket: string; threshold: number }>;
};

/**
 * Top-level dispatcher invoked from the cron route on every tick. Each
 * sub-flow guards its own "is it time?" check, so this is safe to call
 * frequently — the only side effect of an off-cadence call is a few
 * cheap database reads.
 *
 * Returns a structured summary so the cron route can emit one log line
 * with the outcome instead of every flow logging individually.
 */
export async function dispatchAdminNotifications(
  now: Date = new Date(),
): Promise<AdminNotificationDispatchSummary> {
  if (!readAdminEmail()) {
    // Without an admin mailbox there is nothing to send. We still call
    // the milestone tracker because it's harmless (writes will be
    // skipped at the transport layer) and it keeps the state machine
    // consistent if ADMIN_EMAIL is set later.
    return {
      biweekly: null,
      monthlyArchive: null,
      monthlyErrorReport: null,
      milestonesSent: [],
    };
  }

  const [biweekly, monthlyArchive, monthlyErrorReport, milestones] = await Promise.all([
    maybeSendBiweeklyReport(now).catch((e) => {
      logger.error("admin.biweekly.dispatch_failed", { error: String(e) });
      return null;
    }),
    maybeSendMonthlyArchiveCleanup(now).catch((e) => {
      logger.error("admin.monthly_archive.dispatch_failed", { error: String(e) });
      return null;
    }),
    maybeSendMonthlyErrorReport(now).catch((e) => {
      logger.error("admin.monthly_error_report.dispatch_failed", { error: String(e) });
      return null;
    }),
    processMilestoneNotifications().catch((e) => {
      logger.error("admin.milestones.dispatch_failed", { error: String(e) });
      return { sent: [] };
    }),
  ]);

  return {
    biweekly,
    monthlyArchive,
    monthlyErrorReport,
    milestonesSent: milestones.sent,
  };
}

/**
 * Convenience export for tests + diagnostics. Emits a Critical Failure
 * email and writes a critical-severity row to ErrorLog so the same event
 * also lands in the next monthly Error Report PDF.
 */
export async function reportCriticalFailure(params: {
  kind: string;
  message: string;
  stack?: string;
  context?: Record<string, string>;
}): Promise<AdminSendOutcome | null> {
  if (!readAdminEmail()) return null;
  return sendCriticalFailureAlert(params);
}

export async function reportSecurityBreach(params: {
  kind: string;
  summary: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  detail?: Record<string, string>;
}): Promise<AdminSendOutcome | null> {
  if (!readAdminEmail()) return null;
  return sendSecurityBreachAlert(params);
}
