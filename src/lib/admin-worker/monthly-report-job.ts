/**
 * Monthly Admin Worker Report job. Designed to be called from the
 * existing worker daily tick — when today is the last day of the
 * calendar month, it generates the monthly PDF, writes a forensic
 * AdminDeveloperReportLog row, and emails the PDF to ADMIN_EMAIL.
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

/**
 * Top-level entry point. Safe to call daily — the gate exits early on
 * non-last days. When `force=true` is passed (tests + manual trigger
 * from the Command Center), the gate is bypassed.
 */
export async function runMonthlyReportJobIfDue(
  prisma: PrismaClient,
  opts: { now?: Date; force?: boolean } = {},
): Promise<MonthlyReportRunOutcome> {
  const now = opts.now ?? new Date();
  if (!opts.force && !isLastDayOfMonth(now)) {
    return { ran: false, reason: "Not the last day of the month." };
  }

  const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthEnd = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59);

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
    await writeAdminWorkerLog(prisma, {
      category: "REPORT",
      severity: delivery === "failed" ? "ERROR" : "INFO",
      eventName: `monthly_report_${delivery}`,
      message: `Monthly Admin Worker Report ${delivery} (${monthStart.toISOString().slice(0, 10)}–${monthEnd.toISOString().slice(0, 10)}).`,
      safeMetadata: {
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString(),
        bytes: pdf.length,
        deliveryReason: result.ok
          ? result.delivery === "sent"
            ? "sent"
            : result.reason
          : result.reason,
      },
    });

    return {
      ran: true,
      reason: `Monthly Admin Worker Report ${delivery}.`,
      delivery,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeAdminWorkerLog(prisma, {
      category: "REPORT",
      severity: "ERROR",
      eventName: "monthly_report_failed",
      message: `Monthly Admin Worker Report failed: ${message.slice(0, 300)}`,
    });
    return { ran: true, reason: message, delivery: "failed" };
  }
}
