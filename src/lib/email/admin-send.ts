import { logger } from "@/lib/observability";
import { isEmailConfigured, sendTransactionalEmail, type SendEmailResult } from "./resend";
import {
  CONTENT_TYPE_ROWS,
  formatAdded,
  formatDeleted,
  formatPlain,
  renderAdminEmail,
  type AdminEmailSection,
} from "./admin-templates";

/**
 * Resolve the operator alert mailbox. ADMIN_EMAIL is the canonical
 * variable name; we read it through `process.env` directly (rather than
 * the cached `getEnv()` snapshot) for the same reason the Resend helper
 * does — Railway / Vercel inject environment values per-process and the
 * cached snapshot can lag behind on cold-starts. Returns the trimmed
 * address, or null when the variable is unset / empty.
 */
export function readAdminEmail(): string | null {
  const candidate = process.env.ADMIN_EMAIL;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type AdminSendOutcome =
  | { ok: true; delivery: "sent" }
  | { ok: true; delivery: "skipped"; reason: "admin_email_not_set" | "email_not_configured" }
  | { ok: false; reason: string; statusCode?: number };

async function sendAdminEmail(input: {
  flow: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  /** Optional attachment for messages that ship a PDF (monthly Error Report). */
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}): Promise<AdminSendOutcome> {
  const to = readAdminEmail();
  if (!to) {
    logger.warn("admin.email.skipped_no_address", {
      flow: input.flow,
      reason: "ADMIN_EMAIL not set",
      subject: input.subject,
    });
    return { ok: true, delivery: "skipped", reason: "admin_email_not_set" };
  }
  if (!isEmailConfigured()) {
    logger.warn("admin.email.skipped_no_provider", {
      flow: input.flow,
      reason: "RESEND_API_KEY not set",
      subject: input.subject,
    });
    return { ok: true, delivery: "skipped", reason: "email_not_configured" };
  }

  const result: SendEmailResult = await sendTransactionalEmail({
    to,
    subject: input.subject,
    textBody: input.textBody,
    htmlBody: input.htmlBody,
    attachments: input.attachments,
  });

  if (!result.ok) {
    logger.error("admin.email.delivery_failed", {
      flow: input.flow,
      subject: input.subject,
      reason: result.reason,
      errorName: result.errorName,
      errorMessage: result.errorMessage,
      statusCode: result.statusCode,
    });
    return {
      ok: false,
      reason: result.errorMessage ?? result.reason,
      statusCode: result.statusCode,
    };
  }
  if (result.delivery === "skipped") {
    return { ok: true, delivery: "skipped", reason: "email_not_configured" };
  }
  logger.info("admin.email.sent", { flow: input.flow, subject: input.subject });
  return { ok: true, delivery: "sent" };
}

/**
 * Per-content-type counts for one window (biweekly = 14 days). The keys
 * match the `contentType` column written by `recordDataManagementLogs`.
 */
export type ContentManagementCounts = Record<
  string,
  {
    added: number;
    edited: number;
    deleted: number;
    archived: number;
    /** Items dropped by ingestion as duplicates (DEDUPE action). */
    deduped?: number;
    /** Items hard-deleted after the archive retention window (PURGE action). */
    purged?: number;
  }
>;

/**
 * Biweekly Content Management Report.
 *
 * Subject: "Biweekly Admin Report" — spelled exactly as required.
 * Body: a single section titled "Content Management Report" containing
 * a table with columns Content / Added / Edited / Deleted / Archived.
 * Numbers in the Added column carry a leading + when > 0. Numbers in
 * the Deleted column carry a leading - when > 0. Zeroes are rendered
 * as plain `0`.
 */
export type IngestionHealthSummary = {
  totalJobsRun: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsRetried: number;
  itemsSentToReview: number;
  sourcesFailing: number;
  archivedThisWindow: number;
  permanentlyDeletedThisWindow: number;
  dedupedThisWindow: number;
};

/**
 * Content QA summary appended to the biweekly admin report. Reports
 * the per-content-type counts the strict QA pipeline produced over
 * the window plus the current snapshot of threshold-eligible rows
 * and content-type completeness percentages.
 */
export type ContentQASummary = {
  rejectedThisWindow: Record<string, number>;
  invalidPublicRowsDeletedThisWindow: Record<string, number>;
  thresholdEligible: Record<string, number>;
  completenessPercent: Record<string, number>;
};

export async function sendBiweeklyAdminReport(
  counts: ContentManagementCounts,
  windowStart: Date,
  windowEnd: Date,
  ingestionHealth?: IngestionHealthSummary,
  contentQA?: ContentQASummary,
): Promise<AdminSendOutcome> {
  const rows = CONTENT_TYPE_ROWS.map((row) => {
    const c = counts[row.key] ?? {
      added: 0,
      edited: 0,
      deleted: 0,
      archived: 0,
      deduped: 0,
      purged: 0,
    };
    return {
      Content: row.label,
      Added: formatAdded(c.added),
      Edited: formatPlain(c.edited),
      Deleted: formatDeleted(c.deleted),
      Archived: formatPlain(c.archived),
      Deduped: formatPlain((c as { deduped?: number }).deduped ?? 0),
      Purged: formatDeleted((c as { purged?: number }).purged ?? 0),
    };
  });

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const intro =
    `Two weeks of content management activity across the catalog (${fmt(windowStart)} – ${fmt(windowEnd)}). ` +
    `The Added column shows new items, Edited shows modifications, Deleted shows removals, ` +
    `Archived shows items moved to the cleanup queue, Deduped shows duplicates ` +
    `discarded by ingestion, and Purged shows archived items permanently deleted.`;

  const sections: AdminEmailSection[] = [
    {
      title: "Content Management Report",
      table: {
        columns: [
          { key: "Content", label: "Content" },
          { key: "Added", label: "Added", align: "right" },
          { key: "Edited", label: "Edited", align: "right" },
          { key: "Deleted", label: "Deleted", align: "right" },
          { key: "Archived", label: "Archived", align: "right" },
          { key: "Deduped", label: "Deduped", align: "right" },
          { key: "Purged", label: "Purged", align: "right" },
        ],
        rows,
      },
    },
  ];

  if (ingestionHealth) {
    sections.push({
      title: "Ingestion Health Summary",
      table: {
        columns: [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value", align: "right" },
        ],
        rows: [
          { metric: "Total jobs run", value: String(ingestionHealth.totalJobsRun) },
          { metric: "Jobs completed", value: String(ingestionHealth.jobsCompleted) },
          { metric: "Jobs failed", value: String(ingestionHealth.jobsFailed) },
          { metric: "Jobs retried", value: String(ingestionHealth.jobsRetried) },
          { metric: "Items sent to review", value: String(ingestionHealth.itemsSentToReview) },
          { metric: "Sources failing", value: String(ingestionHealth.sourcesFailing) },
          {
            metric: "Items archived this window",
            value: String(ingestionHealth.archivedThisWindow),
          },
          {
            metric: "Archived items permanently deleted",
            value: String(ingestionHealth.permanentlyDeletedThisWindow),
          },
          { metric: "Items deduped", value: String(ingestionHealth.dedupedThisWindow) },
        ],
      },
    });
  }

  if (contentQA) {
    sections.push({
      title: "Content QA Report",
      table: {
        columns: [
          { key: "Content", label: "Content" },
          { key: "Rejected", label: "Rejected", align: "right" },
          { key: "Deleted", label: "Invalid deleted", align: "right" },
          { key: "ThresholdEligible", label: "Threshold eligible", align: "right" },
          { key: "CompletePct", label: "Complete %", align: "right" },
        ],
        rows: CONTENT_TYPE_ROWS.map((row) => ({
          Content: row.label,
          Rejected: formatPlain(contentQA.rejectedThisWindow[row.key] ?? 0),
          Deleted: formatDeleted(contentQA.invalidPublicRowsDeletedThisWindow[row.key] ?? 0),
          ThresholdEligible: formatPlain(contentQA.thresholdEligible[row.key] ?? 0),
          CompletePct: `${contentQA.completenessPercent[row.key] ?? 0}%`,
        })),
      },
    });
  }

  const rendered = renderAdminEmail({
    subject: "Biweekly Admin Report",
    heading: "Biweekly Admin Report",
    intro,
    sections,
  });
  return sendAdminEmail({
    flow: "biweekly_report",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

/**
 * Monthly Archive Cleanup report.
 *
 * Subject: "Monthly Archive Cleaning Up" — spelled exactly as required.
 * Body: one table with columns Content / Archived Deleted listing the
 * number of archived items the cleanup pass permanently removed for
 * each content type. The Archived Deleted column carries a leading -
 * when > 0; zeroes are rendered as plain `0`.
 */
export async function sendMonthlyArchiveCleanupReport(
  counts: Record<string, number>,
  monthStart: Date,
  monthEnd: Date,
): Promise<AdminSendOutcome> {
  const rows = CONTENT_TYPE_ROWS.map((row) => {
    const n = counts[row.key] ?? 0;
    return {
      Content: row.label,
      "Archived Deleted": formatDeleted(n),
    };
  });

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const intro =
    `End-of-month archive cleanup summary (${fmt(monthStart)} – ${fmt(monthEnd)}). ` +
    `Items archived for at least 30 days were permanently removed from the catalog.`;

  const sections: AdminEmailSection[] = [
    {
      title: "Archive Cleanup Summary",
      table: {
        columns: [
          { key: "Content", label: "Content" },
          { key: "Archived Deleted", label: "Archived Deleted", align: "right" },
        ],
        rows,
      },
    },
  ];

  const rendered = renderAdminEmail({
    subject: "Monthly Archive Cleaning Up",
    heading: "Monthly Archive Cleaning Up",
    intro,
    sections,
  });
  return sendAdminEmail({
    flow: "monthly_archive_cleanup",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

/**
 * Threshold milestone alert. Fired when a tracked content type crosses
 * 25 / 50 / 75 / 100 percent of its configured target. Each crossing
 * sends one email — duplicate suppression lives in the milestone
 * tracker so a single threshold cannot send twice.
 */
export async function sendThresholdMilestoneAlert(params: {
  contentLabel: string;
  threshold: 25 | 50 | 75 | 100;
  currentCount: number;
  target: number;
}): Promise<AdminSendOutcome> {
  const { contentLabel, threshold, currentCount, target } = params;
  const isFinal = threshold === 100;
  const subject = isFinal
    ? `${contentLabel} Final Threshold Reached`
    : `${contentLabel} ${threshold}% Threshold Reached`;
  const intro = isFinal
    ? `${contentLabel} has reached its required minimum (${currentCount} of ${target}). The scheduler will switch this bucket to maintenance mode on the next tick.`
    : `${contentLabel} is now at ${threshold}% of the configured minimum (${currentCount} of ${target}).`;
  const sections: AdminEmailSection[] = [
    {
      title: "Threshold Detail",
      table: {
        columns: [
          { key: "key", label: "Field" },
          { key: "value", label: "Value", align: "right" },
        ],
        rows: [
          { key: "Content", value: contentLabel },
          { key: "Threshold", value: `${threshold}%` },
          { key: "Current count", value: String(currentCount) },
          { key: "Target", value: String(target) },
        ],
      },
    },
  ];
  const rendered = renderAdminEmail({
    subject,
    heading: subject,
    intro,
    sections,
  });
  return sendAdminEmail({
    flow: "threshold_milestone",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

/**
 * Critical failure alert. Reserved for severe issues only — uncaught
 * exceptions, unhandled rejections, and the global error boundary.
 * Per-request 4xx responses, validation errors, and
 * upstream-source 5xx do NOT trigger this email; those land in the
 * monthly Error Report PDF instead.
 */
export async function sendCriticalFailureAlert(params: {
  kind: string;
  message: string;
  stack?: string;
  context?: Record<string, string>;
}): Promise<AdminSendOutcome> {
  const intro = `A critical failure has been detected: ${params.kind}.`;
  const contextRows = Object.entries(params.context ?? {}).map(([k, v]) => ({
    key: k,
    value: v,
  }));
  const sections: AdminEmailSection[] = [
    {
      title: "Failure",
      paragraphs: [params.message],
    },
  ];
  if (contextRows.length > 0) {
    sections.push({
      title: "Context",
      table: {
        columns: [
          { key: "key", label: "Field" },
          { key: "value", label: "Value" },
        ],
        rows: contextRows,
      },
    });
  }
  if (params.stack) {
    sections.push({
      title: "Stack trace",
      paragraphs: [params.stack.split("\n").slice(0, 30).join("\n")],
    });
  }
  const rendered = renderAdminEmail({
    subject: "Critical Failure",
    heading: "Critical Failure",
    intro,
    sections,
    signoff: "Investigate the cause as soon as possible.",
  });
  return sendAdminEmail({
    flow: "critical_failure",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

/**
 * Security breach alert. Fired when the app detects suspicious activity:
 * unauthorised client-side tampering, browser-inspector / devtools
 * tampering, attempts to call admin APIs without authentication,
 * malformed admin requests that look like an injection probe, or
 * repeated failed-auth bursts from a single IP.
 */
export async function sendSecurityBreachAlert(params: {
  kind: string;
  summary: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  detail?: Record<string, string>;
}): Promise<AdminSendOutcome> {
  const intro = `A security event has been detected: ${params.kind}.`;
  const sections: AdminEmailSection[] = [
    {
      title: "Summary",
      paragraphs: [params.summary],
    },
  ];
  const contextRows: Array<{ key: string; value: string }> = [];
  if (params.route) contextRows.push({ key: "Route", value: params.route });
  if (params.ipAddress) contextRows.push({ key: "IP address", value: params.ipAddress });
  if (params.userAgent) contextRows.push({ key: "User-Agent", value: params.userAgent });
  for (const [k, v] of Object.entries(params.detail ?? {})) {
    contextRows.push({ key: k, value: v });
  }
  if (contextRows.length > 0) {
    sections.push({
      title: "Context",
      table: {
        columns: [
          { key: "key", label: "Field" },
          { key: "value", label: "Value" },
        ],
        rows: contextRows,
      },
    });
  }
  const rendered = renderAdminEmail({
    subject: "Security Breach",
    heading: "Security Breach",
    intro,
    sections,
    signoff: "Review the details and rotate credentials if compromise is suspected.",
  });
  return sendAdminEmail({
    flow: "security_breach",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

/**
 * Monthly Error Report. The body is a one-paragraph summary of the
 * counts; the full per-error detail ships as a PDF attachment whose
 * filename encodes the year + month so an admin can keep an archive
 * of the reports.
 */
export async function sendMonthlyErrorReport(params: {
  monthStart: Date;
  monthEnd: Date;
  totalErrors: number;
  pdfBase64: string;
}): Promise<AdminSendOutcome> {
  const { monthStart, monthEnd, totalErrors, pdfBase64 } = params;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const intro = `Monthly error report for ${fmt(monthStart)} – ${fmt(monthEnd)}: ${totalErrors} logged ${totalErrors === 1 ? "error" : "errors"}. The full per-error detail is attached as a PDF.`;
  const filename = `error-report-${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}.pdf`;

  const rendered = renderAdminEmail({
    subject: "Error Report",
    heading: "Error Report",
    intro,
    sections: [
      {
        title: "Summary",
        paragraphs: [
          totalErrors === 0
            ? "No errors were logged during this period."
            : `${totalErrors} ${totalErrors === 1 ? "error" : "errors"} are detailed in the attached PDF.`,
        ],
      },
    ],
  });

  return sendAdminEmail({
    flow: "monthly_error_report",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
    attachments: [
      {
        filename,
        content: pdfBase64,
        contentType: "application/pdf",
      },
    ],
  });
}

export type SourceQualityRow = {
  sourceName: string;
  sourceHost: string;
  tier: number;
  accepted: number;
  rejected: number;
  duplicate: number;
  failed: number;
};

/**
 * Monthly source quality report. Shows per-source counts of items
 * accepted (ADD), rejected (REJECT), duplicate (DEDUPE), and failed
 * (FAIL) over the calendar month. Helps the admin see which sources
 * pull their weight and which produce mostly noise.
 */
export async function sendMonthlySourceQualityReport(
  rows: SourceQualityRow[],
  monthStart: Date,
  monthEnd: Date,
): Promise<AdminSendOutcome> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const intro =
    `Monthly source quality report for ${fmt(monthStart)} – ${fmt(monthEnd)}. ` +
    `Sources are ranked by total accepted items; tier 1 (official Church), tier 2 (established ` +
    `publishers), and tier 3 (general/news) classifications are shown so you can see whether ` +
    `the most-active sources are also the highest-trust ones.`;

  const tableRows = rows
    .sort((a, b) => b.accepted - a.accepted)
    .map((r) => ({
      Source: `${r.sourceName} (${r.sourceHost})`,
      Tier: `T${r.tier}`,
      Accepted: formatPlain(r.accepted),
      Rejected: formatPlain(r.rejected),
      Duplicate: formatPlain(r.duplicate),
      Failed: formatPlain(r.failed),
    }));

  const sections: AdminEmailSection[] = [
    {
      title: "Source Quality",
      table: {
        columns: [
          { key: "Source", label: "Source" },
          { key: "Tier", label: "Tier" },
          { key: "Accepted", label: "Accepted", align: "right" },
          { key: "Rejected", label: "Rejected", align: "right" },
          { key: "Duplicate", label: "Duplicate", align: "right" },
          { key: "Failed", label: "Failed", align: "right" },
        ],
        rows: tableRows,
      },
    },
  ];

  const rendered = renderAdminEmail({
    subject: "Monthly Source Quality Report",
    heading: "Monthly Source Quality Report",
    intro,
    sections,
  });
  return sendAdminEmail({
    flow: "monthly_source_quality",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}
