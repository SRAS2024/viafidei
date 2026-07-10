/**
 * Monthly Admin Worker Report job. Called from the reporting lane on EVERY
 * worker pass (and once at process startup) — the job gates itself:
 *
 *   1. On the last day of a calendar month, it generates that month's PDF,
 *      emails it to ADMIN_EMAIL, and records a durable
 *      AdminDeveloperReportLog row stamped with the report month.
 *   2. CATCH-UP: if the PREVIOUS month's report was never recorded (and the
 *      worker actually ran that month), it sends it late. This is what makes
 *      the job robust to the failure that shipped originally: the check used
 *      to run ONLY at process startup, so the report fired only if the worker
 *      container happened to restart exactly on the last day of the month —
 *      a worker deployed June 5 that ran continuously never sent the June 30
 *      report. Late is better than never; the recurring lane call plus this
 *      catch-up means a missed day can no longer lose a month.
 *   3. DEDUP: the durable month marker guarantees at most one report per
 *      month no matter how many passes (or restarts) hit the gate that day.
 *   4. BACKOFF: a failed generation/send is recorded and retried no more than
 *      once per RETRY_COOLDOWN so a persistent email outage doesn't attempt a
 *      send on every ~15s pass.
 *
 * Spec section 13:
 *   - sent on the last day of every month
 *   - February + shorter months are handled
 *   - PDF attached, titled "Admin Worker Monthly Report"
 *   - daily sections + monthly summary
 *   - report must not include secrets (handled in pdf.ts via
 *     `redactSecrets` + `redactString`)
 *   - success or failure must be logged
 */

import type { PrismaClient } from "@prisma/client";

import { sendAdminWorkerMonthlyReport } from "@/lib/email/admin-send";
import { isLastDayOfMonth, buildMonthlySummary } from "./report-generator";
import { generateMonthlyAdminWorkerReportPdf } from "./pdf";
import { writeAdminWorkerLog } from "./logs";

export interface MonthlyReportRunOutcome {
  ran: boolean;
  reason: string;
  delivery?: "sent" | "skipped" | "failed";
}

/** `generatedBy` stamp identifying this job's durable report-log rows. */
export const MONTHLY_REPORT_GENERATED_BY = "admin-worker-monthly-report";

/** Minimum wait between retries after a failed generation/send. */
const RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** "MONTH:2026-06" — the month a report-log row covers, kept queryable. */
function monthTag(year: number, month0: number): string {
  return `MONTH:${year}-${String(month0 + 1).padStart(2, "0")}`;
}

interface TargetMonth {
  year: number;
  month0: number;
  start: Date;
  end: Date;
  tag: string;
  catchUp: boolean;
}

function monthWindow(year: number, month0: number, catchUp: boolean): TargetMonth {
  return {
    year,
    month0,
    start: new Date(Date.UTC(year, month0, 1)),
    end: new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59)),
    tag: monthTag(year, month0),
    catchUp,
  };
}

/**
 * The durable month marker. Tolerates a prisma client without the model
 * (minimal test harnesses) by treating the month as unsent.
 */
async function lastReportRowForMonth(
  prisma: PrismaClient,
  tag: string,
): Promise<{ status: string; generatedAt: Date } | null> {
  if (typeof prisma.adminDeveloperReportLog?.findFirst !== "function") return null;
  return prisma.adminDeveloperReportLog
    .findFirst({
      where: { generatedBy: MONTHLY_REPORT_GENERATED_BY, includedSections: { has: tag } },
      orderBy: { generatedAt: "desc" },
      select: { status: true, generatedAt: true },
    })
    .catch(() => null);
}

/**
 * Decide which month's report (if any) is due right now.
 */
async function resolveDueMonth(prisma: PrismaClient, now: Date): Promise<TargetMonth | null> {
  const current = monthWindow(now.getUTCFullYear(), now.getUTCMonth(), false);

  // 1. Last day of the month → this month's report, unless already sent (or a
  //    recent attempt failed and is still cooling down).
  if (isLastDayOfMonth(now)) {
    const row = await lastReportRowForMonth(prisma, current.tag);
    if (!row) return current;
    if (row.status === "FAILED" && now.getTime() - row.generatedAt.getTime() > RETRY_COOLDOWN_MS) {
      return current;
    }
    return null;
  }

  // 2. Catch-up: the previous month's report was never generated. Only when
  //    the worker actually ran that month — a fresh install must not mail an
  //    empty report for a month it never worked.
  const prevYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const prevMonth0 = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
  const prev = monthWindow(prevYear, prevMonth0, true);
  const prevRow = await lastReportRowForMonth(prisma, prev.tag);
  const prevDue =
    !prevRow ||
    (prevRow.status === "FAILED" &&
      now.getTime() - prevRow.generatedAt.getTime() > RETRY_COOLDOWN_MS);
  if (!prevDue) return null;
  const activity =
    typeof prisma.adminWorkerPass?.count === "function"
      ? await prisma.adminWorkerPass
          .count({ where: { startedAt: { gte: prev.start, lte: prev.end } } })
          .catch(() => 0)
      : 0;
  return activity > 0 ? prev : null;
}

async function recordMonthMarker(
  prisma: PrismaClient,
  target: TargetMonth,
  outcome: { ok: boolean; bytes?: number; error?: string },
): Promise<void> {
  if (typeof prisma.adminDeveloperReportLog?.create !== "function") return;
  await prisma.adminDeveloperReportLog
    .create({
      data: {
        reportPeriod: "LAST_30_DAYS",
        generatedBy: MONTHLY_REPORT_GENERATED_BY,
        status: outcome.ok ? "GENERATED" : "FAILED",
        fileSize: outcome.bytes ?? null,
        errorMessage: outcome.error?.slice(0, 500) ?? null,
        includedSections: [target.tag],
      },
    })
    .catch(() => undefined);
}

/**
 * Top-level entry point. Safe to call on every pass — the gate exits early
 * unless a report is genuinely due (last day of month, or a missed previous
 * month), and the durable month marker makes it idempotent. When `force=true`
 * is passed (tests + manual trigger from the Command Center), the gate is
 * bypassed and the current month-to-date is reported immediately.
 */
export async function runMonthlyReportJobIfDue(
  prisma: PrismaClient,
  opts: { now?: Date; force?: boolean } = {},
): Promise<MonthlyReportRunOutcome> {
  const now = opts.now ?? new Date();

  const target = opts.force
    ? monthWindow(now.getUTCFullYear(), now.getUTCMonth(), false)
    : await resolveDueMonth(prisma, now);
  if (!target) {
    return { ran: false, reason: "No monthly report due (not month-end; no missed month)." };
  }

  const { start: monthStart, end: monthEnd } = target;
  try {
    const summary = await buildMonthlySummary(prisma, monthStart, monthEnd);
    const pdf = await generateMonthlyAdminWorkerReportPdf(prisma, monthStart, monthEnd);
    const pdfBase64 = pdf.toString("base64");

    const result = await sendAdminWorkerMonthlyReport({
      monthStart,
      monthEnd,
      totalContentBuilt: summary.totalContentBuilt,
      totalContentPublished: summary.totalContentPublished,
      totalContentRejected: summary.totalContentRejected,
      totalContentDeleted: summary.totalContentDeleted,
      totalSourcesUsed: summary.totalSourcesUsed,
      workerUptimePct: summary.workerUptimePct,
      workerFailures: summary.workerFailures,
      securityEvents: summary.securityEvents,
      homepageChanges: summary.homepageChanges,
      pdfBase64,
    });

    const delivery =
      result.ok && result.delivery === "sent" ? "sent" : result.ok ? "skipped" : "failed";
    // Durable month marker: GENERATED (sent, or skipped because email is
    // deliberately unconfigured — don't retry-spam either way) vs FAILED
    // (retry after the cooldown).
    await recordMonthMarker(prisma, target, {
      ok: delivery !== "failed",
      bytes: pdf.length,
      error: result.ok ? undefined : result.reason,
    });
    await writeAdminWorkerLog(prisma, {
      category: "REPORT",
      severity: delivery === "failed" ? "ERROR" : "INFO",
      eventName: `monthly_report_${delivery}`,
      message: `Monthly Admin Worker Report ${delivery}${target.catchUp ? " (catch-up for a missed month-end)" : ""} (${monthStart.toISOString().slice(0, 10)}–${monthEnd.toISOString().slice(0, 10)}).`,
      safeMetadata: {
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString(),
        bytes: pdf.length,
        catchUp: target.catchUp,
        deliveryReason: result.ok
          ? result.delivery === "sent"
            ? "sent"
            : result.reason
          : result.reason,
      },
    });

    return {
      ran: true,
      reason: `Monthly Admin Worker Report ${delivery}${target.catchUp ? " (catch-up)" : ""}.`,
      delivery,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordMonthMarker(prisma, target, { ok: false, error: message });
    await writeAdminWorkerLog(prisma, {
      category: "REPORT",
      severity: "ERROR",
      eventName: "monthly_report_failed",
      message: `Monthly Admin Worker Report failed: ${message.slice(0, 300)}`,
    });
    return { ran: true, reason: message, delivery: "failed" };
  }
}
