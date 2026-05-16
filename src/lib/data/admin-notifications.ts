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
  sendMonthlySourceQualityReport,
  sendSecurityBreachAlert,
  sendThresholdMilestoneAlert,
  type AdminSendOutcome,
  type ContentManagementCounts,
  type IngestionHealthSummary,
  type SourceQualityRow,
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
    counts[row.key] = { added: 0, edited: 0, deleted: 0, archived: 0, deduped: 0, purged: 0 };
  }
  for (const row of rows) {
    if (!counts[row.contentType]) {
      counts[row.contentType] = {
        added: 0,
        edited: 0,
        deleted: 0,
        archived: 0,
        deduped: 0,
        purged: 0,
      };
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
        // DELETE is admin-triggered or noise-discard; not the same as
        // PURGE (which is the archive cleanup hard-delete). They both
        // remove content, so we still fold them together in the
        // "deleted" column but split PURGE separately for visibility.
        target.deleted += n;
        break;
      case "PURGE":
        target.deleted += n;
        target.purged = (target.purged ?? 0) + n;
        break;
      case "CLEANUP":
        target.archived += n;
        break;
      case "DEDUPE":
        // Deduped items are tracked separately so admin reports show
        // the dedupe volume distinctly from normal archiving. A
        // deduped item that is also archived (because it was a near-
        // duplicate of a kept row) still increments the dedupe count
        // here in addition to the CLEANUP-driven archived count.
        target.deduped = (target.deduped ?? 0) + n;
        break;
      default:
        break;
    }
  }
  return counts;
}

/**
 * Compute the ingestion-health summary appended to every biweekly
 * report. Pulls per-status counts from `IngestionJobQueue` over the
 * window plus the current count of failing sources.
 */
async function aggregateIngestionHealth(
  windowStart: Date,
  windowEnd: Date,
): Promise<IngestionHealthSummary> {
  const inWindow = { createdAt: { gte: windowStart, lt: windowEnd } };
  const [totalJobsRun, jobsCompleted, jobsFailed, jobsRetried, itemsSentToReview, sourcesFailing] =
    await Promise.all([
      prisma.ingestionJobQueue.count({ where: { startedAt: { gte: windowStart, lt: windowEnd } } }),
      prisma.ingestionJobQueue.count({
        where: { status: "completed", finishedAt: { gte: windowStart, lt: windowEnd } },
      }),
      prisma.ingestionJobQueue.count({
        where: { status: "failed", finishedAt: { gte: windowStart, lt: windowEnd } },
      }),
      prisma.ingestionJobQueue.count({
        where: { status: "retrying", updatedAt: { gte: windowStart, lt: windowEnd } },
      }),
      prisma.ingestionJobRun.aggregate({
        where: inWindow,
        _sum: { recordsReviewRequired: true },
      }),
      prisma.ingestionSource.count({
        where: { healthState: { in: ["failing", "blocked"] } },
      }),
    ]);

  // Archive deletions for the window — pulled from ArchiveDeletionLog
  // because that's the authoritative audit table for hard deletes.
  const [archivedThisWindow, permanentlyDeletedThisWindow, dedupedThisWindow] = await Promise.all([
    prisma.dataManagementLog.count({
      where: { action: "CLEANUP", createdAt: { gte: windowStart, lt: windowEnd } },
    }),
    prisma.archiveDeletionLog.count({
      where: { deletedAt: { gte: windowStart, lt: windowEnd } },
    }),
    prisma.dataManagementLog.count({
      where: { action: "DEDUPE", createdAt: { gte: windowStart, lt: windowEnd } },
    }),
  ]);

  return {
    totalJobsRun,
    jobsCompleted,
    jobsFailed,
    jobsRetried,
    itemsSentToReview: itemsSentToReview._sum.recordsReviewRequired ?? 0,
    sourcesFailing,
    archivedThisWindow,
    permanentlyDeletedThisWindow,
    dedupedThisWindow,
  };
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
  const [counts, health] = await Promise.all([
    aggregateContentManagementCounts(windowStart, windowEnd),
    aggregateIngestionHealth(windowStart, windowEnd).catch(() => undefined),
  ]);
  const result = await sendBiweeklyAdminReport(counts, windowStart, windowEnd, health);
  if (result.ok && result.delivery === "sent") {
    await setFlowState<BiweeklyState>("biweekly_report", {
      lastSentAt: now.toISOString(),
    });
  }
  return result;
}

/**
 * Monthly source quality report. Per source, counts the items
 * accepted (ADD), rejected (REJECT), deduped (DEDUPE), and failed
 * (FAIL) over the calendar month. Helps the admin see which sources
 * carry the catalog and which produce mostly noise.
 */
async function aggregateMonthlySourceQuality(
  windowStart: Date,
  windowEnd: Date,
): Promise<SourceQualityRow[]> {
  const [sources, runRows, logRows] = await Promise.all([
    prisma.ingestionSource.findMany(),
    prisma.ingestionJobRun.findMany({
      where: { startedAt: { gte: windowStart, lt: windowEnd } },
      include: { job: { include: { source: true } } },
    }),
    prisma.dataManagementLog.groupBy({
      by: ["action", "contentType"],
      where: { createdAt: { gte: windowStart, lt: windowEnd } },
      _count: { _all: true },
    }),
  ]);

  const bySourceId = new Map<string, SourceQualityRow>();
  for (const s of sources) {
    bySourceId.set(s.id, {
      sourceName: s.name,
      sourceHost: s.host,
      tier: s.tier,
      accepted: 0,
      rejected: 0,
      duplicate: 0,
      failed: 0,
    });
  }
  for (const run of runRows) {
    const row = bySourceId.get(run.job.sourceId);
    if (!row) continue;
    row.accepted += run.recordsCreated;
    row.failed += run.recordsFailed;
  }
  // DataManagementLog totals are catalog-wide (not per source), so we
  // attribute REJECT / DEDUPE proportionally to the source that owns
  // the most jobs targeting that contentType. This is best-effort —
  // the per-item provenance would require tracking source on every
  // log row, which we leave for a future schema change.
  const jobsBySource = new Map<string, number>();
  for (const r of runRows) {
    jobsBySource.set(r.job.sourceId, (jobsBySource.get(r.job.sourceId) ?? 0) + 1);
  }
  const totalJobs = Array.from(jobsBySource.values()).reduce((a, b) => a + b, 0) || 1;
  for (const log of logRows) {
    const n = log._count?._all ?? 0;
    for (const [sourceId, jobCount] of jobsBySource) {
      const row = bySourceId.get(sourceId);
      if (!row) continue;
      const attributed = Math.round((n * jobCount) / totalJobs);
      if (log.action === "REJECT") row.rejected += attributed;
      if (log.action === "DEDUPE") row.duplicate += attributed;
    }
  }
  return Array.from(bySourceId.values());
}

async function maybeSendMonthlySourceQualityReport(now: Date): Promise<AdminSendOutcome | null> {
  if (!isLastDayOfMonth(now)) return null;
  const tag = yearMonth(now);
  const state = await getFlowState<MonthlySendState>("monthly_source_quality");
  if (state && state.lastSentYearMonth === tag) return null;
  const wStart = monthStart(now);
  const wEnd = nextMonthStart(now);
  const rows = await aggregateMonthlySourceQuality(wStart, wEnd);
  const result = await sendMonthlySourceQualityReport(rows, wStart, wEnd);
  if (result.ok && result.delivery === "sent") {
    await setFlowState<MonthlySendState>("monthly_source_quality", {
      lastSentYearMonth: tag,
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
 *
 * The state is recorded regardless of whether the email actually went
 * out. Previously, an unconfigured ADMIN_EMAIL or a transport failure
 * would leave the state un-advanced; the moment the operator finally
 * configured ADMIN_EMAIL, the very next tick would fire 25/50/75/100
 * for every bucket all at once (because every threshold had been
 * "newly crossed" against an empty state record). We now mark
 * thresholds as completed once the system detects they were crossed,
 * even if the email was skipped, so the cap-up flow is clean.
 */
export async function processMilestoneNotifications(): Promise<{
  sent: Array<{ bucket: string; threshold: number }>;
  recordedWithoutSend: Array<{ bucket: string; threshold: number }>;
}> {
  const sent: Array<{ bucket: string; threshold: number }> = [];
  const recordedWithoutSend: Array<{ bucket: string; threshold: number }> = [];
  const adminEmailConfigured = !!readAdminEmail();
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
      if (percent < threshold) continue;
      if (!adminEmailConfigured) {
        // ADMIN_EMAIL is not configured. Mark the threshold as
        // completed in state anyway — otherwise the next time the
        // operator sets ADMIN_EMAIL, every previously-crossed
        // milestone fires at once (a known nasty surprise).
        state.sent.push(threshold);
        dirty = true;
        recordedWithoutSend.push({ bucket: bucket.key, threshold });
        continue;
      }
      try {
        const result = await sendThresholdMilestoneAlert({
          contentLabel: bucket.label,
          threshold,
          currentCount: count,
          target: bucket.target,
        });
        // Mark as sent on success OR on `skipped` (e.g. transport
        // disabled by config) so the state machine moves forward.
        if (result.ok) {
          state.sent.push(threshold);
          dirty = true;
          if (result.delivery === "sent") {
            sent.push({ bucket: bucket.key, threshold });
          } else {
            recordedWithoutSend.push({ bucket: bucket.key, threshold });
          }
        } else {
          // Even on hard failure we record the milestone so a
          // retry-storm cannot blow up the inbox. The send was already
          // attempted; remembering that fact is the safer default.
          state.sent.push(threshold);
          dirty = true;
          recordedWithoutSend.push({ bucket: bucket.key, threshold });
        }
      } catch (e) {
        logger.error("admin.milestone.send_failed", {
          bucket: bucket.key,
          threshold,
          error: e instanceof Error ? e.message : String(e),
        });
        // Mark as recorded anyway — see comment above.
        state.sent.push(threshold);
        dirty = true;
        recordedWithoutSend.push({ bucket: bucket.key, threshold });
      }
    }
    if (dirty) {
      await setFlowState<MilestoneState>(flow, state);
    }
  }
  return { sent, recordedWithoutSend };
}

export type AdminNotificationDispatchSummary = {
  biweekly: AdminSendOutcome | null;
  monthlyArchive: AdminSendOutcome | null;
  monthlyErrorReport: AdminSendOutcome | null;
  monthlySourceQuality: AdminSendOutcome | null;
  milestonesSent: Array<{ bucket: string; threshold: number }>;
  milestonesRecordedWithoutSend: Array<{ bucket: string; threshold: number }>;
};

/**
 * Top-level dispatcher invoked from the cron route on every tick. Each
 * sub-flow guards its own "is it time?" check, so this is safe to call
 * frequently — the only side effect of an off-cadence call is a few
 * cheap database reads.
 *
 * Returns a structured summary so the cron route can emit one log line
 * with the outcome instead of every flow logging individually.
 *
 * The milestone tracker runs unconditionally — even when ADMIN_EMAIL
 * is unset. Its state must advance whenever a threshold is crossed
 * so that a later ADMIN_EMAIL configuration does not unleash a flood
 * of old milestone emails on the next tick.
 */
export async function dispatchAdminNotifications(
  now: Date = new Date(),
): Promise<AdminNotificationDispatchSummary> {
  const adminEmail = readAdminEmail();
  // Milestone tracking always runs — see the comment on
  // `processMilestoneNotifications` for why state must update even
  // when ADMIN_EMAIL is absent.
  const milestones = await processMilestoneNotifications().catch((e) => {
    logger.error("admin.milestones.dispatch_failed", { error: String(e) });
    return { sent: [], recordedWithoutSend: [] };
  });

  if (!adminEmail) {
    return {
      biweekly: null,
      monthlyArchive: null,
      monthlyErrorReport: null,
      monthlySourceQuality: null,
      milestonesSent: milestones.sent,
      milestonesRecordedWithoutSend: milestones.recordedWithoutSend,
    };
  }

  const [biweekly, monthlyArchive, monthlyErrorReport, monthlySourceQuality] = await Promise.all([
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
    maybeSendMonthlySourceQualityReport(now).catch((e) => {
      logger.error("admin.monthly_source_quality.dispatch_failed", { error: String(e) });
      return null;
    }),
  ]);

  return {
    biweekly,
    monthlyArchive,
    monthlyErrorReport,
    monthlySourceQuality,
    milestonesSent: milestones.sent,
    milestonesRecordedWithoutSend: milestones.recordedWithoutSend,
  };
}

/**
 * Send a "thresholds-could-not-be-checked" warning when the database
 * count query throws and the scheduler stays in constant mode without
 * knowing for sure whether the catalog is full. Caller is the cron
 * route — it inspects the BacklogProgressResult and fires this only
 * when `dbError === true`.
 */
export async function sendThresholdCheckFailedWarning(
  errorMessage: string,
): Promise<AdminSendOutcome | null> {
  if (!readAdminEmail()) return null;
  const { sendCriticalFailureAlert } = await import("../email");
  return sendCriticalFailureAlert({
    kind: "threshold_check_failed",
    message: `Could not count content totals to check ingestion thresholds. Ingestion is staying in CONSTANT mode until counts succeed again. Cause: ${errorMessage.slice(0, 200)}`,
  });
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
