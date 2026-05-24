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

export type StrictQAHealthSummary = {
  systemScore: number;
  contentQAScore: number;
  durableQueueScore: number;
  sourceQualityScore: number;
  workerReliabilityScore: number;
  thresholdGrowthScore: number;
  publicRenderingScore: number;
  invalidPublicRowCount: number;
  deletedLast24h: number;
  cleanupModeLabel: string;
};

export async function sendBiweeklyAdminReport(
  counts: ContentManagementCounts,
  windowStart: Date,
  windowEnd: Date,
  ingestionHealth?: IngestionHealthSummary,
  contentQA?: ContentQASummary,
  strictQAHealth?: StrictQAHealthSummary,
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

  if (strictQAHealth) {
    sections.push({
      title: "Strict QA System Health",
      table: {
        columns: [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value", align: "right" },
        ],
        rows: [
          { metric: "System health score", value: `${strictQAHealth.systemScore}/100` },
          { metric: "Content QA score", value: `${strictQAHealth.contentQAScore}/100` },
          { metric: "Durable queue score", value: `${strictQAHealth.durableQueueScore}/100` },
          { metric: "Source quality score", value: `${strictQAHealth.sourceQualityScore}/100` },
          {
            metric: "Worker reliability score",
            value: `${strictQAHealth.workerReliabilityScore}/100`,
          },
          {
            metric: "Threshold growth score",
            value: `${strictQAHealth.thresholdGrowthScore}/100`,
          },
          {
            metric: "Public rendering score",
            value: `${strictQAHealth.publicRenderingScore}/100`,
          },
          {
            metric: "Invalid public rows",
            value: String(strictQAHealth.invalidPublicRowCount),
          },
          {
            metric: "Invalid rows deleted (24h)",
            value: String(strictQAHealth.deletedLast24h),
          },
          { metric: "Cleanup mode", value: strictQAHealth.cleanupModeLabel },
        ],
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
/**
 * Per-content-type deletion counts split by source so the admin can
 * see which deletion mechanism took the rows out. Section 10 of the
 * strict QA spec requires this split.
 */
export type CleanupCategoryCounts = {
  /** Valid old content intentionally archived then deleted after retention. */
  archivedValidDeleted: Record<string, number>;
  /** Strict QA invalid rows deleted with a RejectedContentLog entry. */
  invalidStrictDeleted: Record<string, number>;
  /** Rows the dedupe pass collapsed. */
  duplicateDeleted: Record<string, number>;
  /** Stale rows removed by janitor / age cleanup. */
  staleDeleted: Record<string, number>;
};

export async function sendMonthlyArchiveCleanupReport(
  counts: Record<string, number>,
  monthStart: Date,
  monthEnd: Date,
  categories?: CleanupCategoryCounts,
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

  if (categories) {
    const categoryRows = CONTENT_TYPE_ROWS.map((row) => ({
      Content: row.label,
      "Archived (valid)": formatDeleted(categories.archivedValidDeleted[row.key] ?? 0),
      "Strict QA invalid": formatDeleted(categories.invalidStrictDeleted[row.key] ?? 0),
      Duplicate: formatDeleted(categories.duplicateDeleted[row.key] ?? 0),
      Stale: formatDeleted(categories.staleDeleted[row.key] ?? 0),
    }));
    sections.push({
      title: "Deletion Category Split",
      table: {
        columns: [
          { key: "Content", label: "Content" },
          { key: "Archived (valid)", label: "Archived (valid)", align: "right" },
          { key: "Strict QA invalid", label: "Strict QA invalid", align: "right" },
          { key: "Duplicate", label: "Duplicate", align: "right" },
          { key: "Stale", label: "Stale", align: "right" },
        ],
        rows: categoryRows,
      },
    });
  }

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
  /** Spec-required severity label. Defaults to "Error" if omitted. */
  severity?: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  /** HMAC fingerprint of the originating device credential. */
  deviceCredentialId?: string;
  city?: string;
  region?: string;
  country?: string;
  /** The action the attacker attempted ("admin_password_brute_force", ...). */
  attemptedAction?: string;
  /** Automatic remediation already taken ("session revoked", "device banned", ...). */
  automaticActionTaken?: string;
  /**
   * Optional URL the admin can click to ban the originating device.
   * Only present when the caller has a device-credential fingerprint
   * and has issued a signed, single-use ban token. Suspicious
   * Activity emails never include this link.
   */
  banDeviceUrl?: string;
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
  contextRows.push({ key: "Event type", value: params.kind });
  contextRows.push({ key: "Severity", value: params.severity ?? "Error" });
  contextRows.push({ key: "Time", value: new Date().toISOString() });
  if (params.route) contextRows.push({ key: "Target route", value: params.route });
  if (params.ipAddress) contextRows.push({ key: "IP address", value: params.ipAddress });
  if (params.deviceCredentialId)
    contextRows.push({ key: "Device credential", value: params.deviceCredentialId });
  if (params.userAgent) contextRows.push({ key: "User-Agent", value: params.userAgent });
  if (params.city) contextRows.push({ key: "City", value: params.city });
  if (params.region) contextRows.push({ key: "Region", value: params.region });
  if (params.country) contextRows.push({ key: "Country", value: params.country });
  if (params.attemptedAction)
    contextRows.push({ key: "Action attempted", value: params.attemptedAction });
  if (params.automaticActionTaken)
    contextRows.push({ key: "Automatic action taken", value: params.automaticActionTaken });
  for (const [k, v] of Object.entries(params.detail ?? {})) {
    contextRows.push({ key: k, value: v });
  }
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
  if (params.banDeviceUrl) {
    sections.push({
      title: "Action",
      paragraphs: [`Ban the originating device (single-use, signed token): ${params.banDeviceUrl}`],
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
 * Suspicious Activity email — used for warning signs (failed admin
 * password attempts, sustained client tamper probing, debug endpoint
 * scanning). Distinct from Security Breach because it does not
 * include a ban link and is not used for confirmed attacks.
 */
export async function sendSuspiciousActivityAlert(params: {
  kind: string;
  summary: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  deviceCredentialId?: string;
  city?: string;
  region?: string;
  country?: string;
  attemptedAccountOrRoute?: string;
  recommendedAction?: string;
  detail?: Record<string, string>;
}): Promise<AdminSendOutcome> {
  const intro = `A suspicious-activity signal has been detected: ${params.kind}.`;
  const sections: AdminEmailSection[] = [
    {
      title: "Summary",
      paragraphs: [params.summary],
    },
  ];
  const contextRows: Array<{ key: string; value: string }> = [];
  // Spec-required core fields: every Suspicious Activity email
  // shows event type + time even when no other context is known.
  contextRows.push({ key: "Event type", value: params.kind });
  contextRows.push({ key: "Time", value: new Date().toISOString() });
  if (params.route) contextRows.push({ key: "Route", value: params.route });
  if (params.ipAddress) contextRows.push({ key: "IP address", value: params.ipAddress });
  if (params.deviceCredentialId)
    contextRows.push({ key: "Device credential", value: params.deviceCredentialId });
  if (params.userAgent) contextRows.push({ key: "User-Agent", value: params.userAgent });
  if (params.city) contextRows.push({ key: "City", value: params.city });
  if (params.region) contextRows.push({ key: "Region", value: params.region });
  if (params.country) contextRows.push({ key: "Country", value: params.country });
  if (params.attemptedAccountOrRoute)
    contextRows.push({
      key: "Attempted account/route",
      value: params.attemptedAccountOrRoute,
    });
  for (const [k, v] of Object.entries(params.detail ?? {})) {
    contextRows.push({ key: k, value: v });
  }
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
  if (params.recommendedAction) {
    sections.push({
      title: "Recommended automatic action",
      paragraphs: [params.recommendedAction],
    });
  }
  const rendered = renderAdminEmail({
    subject: "Suspicious Activity",
    heading: "Suspicious Activity",
    intro,
    sections,
    signoff:
      "This is a warning signal, not a confirmed attack. No device has been banned. Investigate at your discretion.",
  });
  return sendAdminEmail({
    flow: "suspicious_activity",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

/**
 * Admin Log In email. Sent whenever an admin successfully signs in.
 * This is deliberately distinct from the Suspicious Activity, Security
 * Breach, and Brute Force emails: a valid sign-in is expected activity,
 * so the operator gets a calm confirmation — not a security alert.
 *
 * Subject is pinned to "Admin Log In". The body shows when, who, the
 * device and location (with explicit "unavailable" copy when a field
 * could not be resolved), whether the device has been seen before, and
 * the SecurityEvent / AdminActionLog reference id.
 */
export async function sendAdminLoginAlert(params: {
  username: string;
  loginAt?: Date;
  ipAddress?: string;
  city?: string;
  region?: string;
  country?: string;
  userAgent?: string;
  browser?: string;
  operatingSystem?: string;
  /** Whether this device credential has signed in before. */
  deviceSeenBefore: boolean;
  /** Whether the sign-in succeeded — true for every Admin Log In email. */
  successful: boolean;
  /** SecurityEvent id or AdminActionLog id tied to this sign-in. */
  referenceId?: string;
}): Promise<AdminSendOutcome> {
  const at = params.loginAt ?? new Date();
  const intro = `A ${params.successful ? "successful" : "failed"} sign-in to the admin account has been recorded.`;
  const rows: Array<{ key: string; value: string }> = [];
  rows.push({ key: "Login timestamp", value: at.toISOString() });
  rows.push({ key: "Username", value: params.username });

  const hasDevice = Boolean(params.userAgent || params.browser || params.operatingSystem);
  if (hasDevice) {
    rows.push({ key: "Browser", value: params.browser ?? "Browser unavailable" });
    rows.push({
      key: "Operating system",
      value: params.operatingSystem ?? "Operating system unavailable",
    });
    rows.push({ key: "User agent", value: params.userAgent ?? "User agent unavailable" });
  } else {
    rows.push({ key: "Device details", value: "Device details unavailable" });
  }

  const hasLocation = Boolean(params.city || params.region || params.country);
  if (hasLocation) {
    rows.push({ key: "City", value: params.city ?? "Unknown" });
    rows.push({ key: "State / region", value: params.region ?? "Unknown" });
    rows.push({ key: "Country", value: params.country ?? "Unknown" });
  } else {
    rows.push({ key: "Location", value: "Location unavailable" });
  }

  rows.push({ key: "IP address", value: params.ipAddress ?? "IP address unavailable" });
  rows.push({
    key: "Device recognised",
    value: params.deviceSeenBefore
      ? "Yes — this device has signed in before"
      : "No — first time this device is seen",
  });
  rows.push({ key: "Login successful", value: params.successful ? "Yes" : "No" });
  if (params.referenceId) rows.push({ key: "Reference id", value: params.referenceId });

  const rendered = renderAdminEmail({
    subject: "Admin Log In",
    heading: "Admin Log In",
    intro,
    sections: [
      {
        title: "Sign-in details",
        table: {
          columns: [
            { key: "key", label: "Field" },
            { key: "value", label: "Value" },
          ],
          rows,
        },
      },
    ],
    signoff:
      "If this sign-in was not you, change the admin password immediately and review the security log.",
  });
  return sendAdminEmail({
    flow: "admin_login",
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

/**
 * Monthly Data Management Report (section 10 of the strict QA spec).
 * Pulls every key durable-queue + strict-QA metric into one report
 * so the operator can see, at a glance, what the system did this
 * month and where its quality is trending.
 *
 * Distinct from the biweekly report (which focuses on per-content-type
 * change counts) and the monthly source quality report (which ranks
 * sources). This is the "data-management operations" view.
 */
export type DataManagementReportData = {
  /** Total queue jobs completed in the month. */
  jobsRun: number;
  /** Per-content-type rows persisted as valid packages. */
  packagesCreated: Record<string, number>;
  /** Per-content-type rows updated. */
  packagesUpdated: Record<string, number>;
  /** Per-content-type rows deleted by strict QA. */
  packagesDeleted: Record<string, number>;
  /** Per-content-type rows that failed pre-persistence rejection. */
  packagesRejected: Record<string, number>;
  /** Source IDs auto-paused in the month. */
  sourcesPaused: number;
  /** Source IDs auto-resumed in the month. */
  sourcesResumed: number;
  /** Content type buckets currently below their configured target. */
  contentTypesBelowThreshold: ReadonlyArray<{
    contentType: string;
    currentCount: number;
    target: number;
    pct: number;
  }>;
  /** Content types that grew by less than `stalledGrowthMinDelta` rows. */
  stalledContentTypes: ReadonlyArray<string>;
  /**
   * Invalid public rows currently in the catalog
   * (status=PUBLISHED but publicRenderReady=false).
   */
  invalidPublicRowCount: number;
  /** Invalid rows the cleanup loop removed in the month. */
  invalidPublicRowsDeleted: number;
  /** Worker uptime ratio over the month (0-1). */
  workerUptimePct: number;
  /** Queue reliability ratio: completed / (completed + failed). */
  queueReliabilityPct: number;
  /** Top 5 failure reasons by count. */
  topFailureReasons: ReadonlyArray<{ category: string; count: number }>;
  /** Top 5 sources by valid-package count. */
  topSuccessfulSources: ReadonlyArray<{ host: string; saved: number }>;
};

export async function sendMonthlyDataManagementReport(
  data: DataManagementReportData,
  monthStart: Date,
  monthEnd: Date,
): Promise<AdminSendOutcome> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const intro =
    `Monthly Data Management Report (${fmt(monthStart)} – ${fmt(monthEnd)}). ` +
    `Summary of every durable-queue and strict-QA action over the month. ` +
    `Use it to spot stalled buckets, dominant sources, and quality trends.`;

  const ctRows = CONTENT_TYPE_ROWS.map((row) => ({
    Content: row.label,
    Created: formatPlain(data.packagesCreated[row.key] ?? 0),
    Updated: formatPlain(data.packagesUpdated[row.key] ?? 0),
    Deleted: formatDeleted(data.packagesDeleted[row.key] ?? 0),
    Rejected: formatDeleted(data.packagesRejected[row.key] ?? 0),
  }));

  const sections: AdminEmailSection[] = [
    {
      title: "Operations Summary",
      table: {
        columns: [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value", align: "right" },
        ],
        rows: [
          { metric: "Jobs run", value: String(data.jobsRun) },
          { metric: "Sources paused", value: String(data.sourcesPaused) },
          { metric: "Sources resumed", value: String(data.sourcesResumed) },
          { metric: "Invalid public rows (current)", value: String(data.invalidPublicRowCount) },
          {
            metric: "Invalid rows deleted",
            value: String(data.invalidPublicRowsDeleted),
          },
          { metric: "Worker uptime", value: `${Math.round(data.workerUptimePct * 100)}%` },
          {
            metric: "Queue reliability",
            value: `${Math.round(data.queueReliabilityPct * 100)}%`,
          },
        ],
      },
    },
    {
      title: "Per-Content-Type Counts",
      table: {
        columns: [
          { key: "Content", label: "Content" },
          { key: "Created", label: "Created", align: "right" },
          { key: "Updated", label: "Updated", align: "right" },
          { key: "Deleted", label: "Deleted", align: "right" },
          { key: "Rejected", label: "Rejected", align: "right" },
        ],
        rows: ctRows,
      },
    },
  ];

  if (data.contentTypesBelowThreshold.length > 0) {
    sections.push({
      title: "Content Types Below Threshold",
      table: {
        columns: [
          { key: "ct", label: "Content type" },
          { key: "current", label: "Current", align: "right" },
          { key: "target", label: "Target", align: "right" },
          { key: "pct", label: "Complete %", align: "right" },
        ],
        rows: data.contentTypesBelowThreshold.map((b) => ({
          ct: b.contentType,
          current: String(b.currentCount),
          target: String(b.target),
          pct: `${Math.round(b.pct * 100)}%`,
        })),
      },
    });
  }

  if (data.stalledContentTypes.length > 0) {
    sections.push({
      title: "Stalled Content Types",
      paragraphs: [
        `These content types did not grow this month: ${data.stalledContentTypes.join(", ")}. ` +
          `Investigate the source health for each — likely needs a paused source resumed or ` +
          `a new source added.`,
      ],
    });
  }

  if (data.topFailureReasons.length > 0) {
    sections.push({
      title: "Top Failure Reasons",
      table: {
        columns: [
          { key: "category", label: "Failure category" },
          { key: "count", label: "Count", align: "right" },
        ],
        rows: data.topFailureReasons.map((r) => ({
          category: r.category,
          count: String(r.count),
        })),
      },
    });
  }

  if (data.topSuccessfulSources.length > 0) {
    sections.push({
      title: "Top Successful Sources",
      table: {
        columns: [
          { key: "host", label: "Host" },
          { key: "saved", label: "Saved this month", align: "right" },
        ],
        rows: data.topSuccessfulSources.map((s) => ({
          host: s.host,
          saved: String(s.saved),
        })),
      },
    });
  }

  const rendered = renderAdminEmail({
    subject: "Monthly Data Management Report",
    heading: "Monthly Data Management Report",
    intro,
    sections,
  });
  return sendAdminEmail({
    flow: "monthly_data_management",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}

// ============================================================================
// Admin Worker emails
// ============================================================================
// Spec sections 13 and 14:
//   - Monthly Admin Worker Report (PDF attachment, last day of month).
//   - Admin Worker Banned Device (when the worker bans a confirmed
//     brute-force device — distinct from the legacy Security Breach
//     email so the operator can tell which one fired).
// ============================================================================

export interface AdminWorkerMonthlyReportInput {
  monthStart: Date;
  monthEnd: Date;
  totalContentBuilt: number;
  totalContentPublished: number;
  totalContentRejected: number;
  totalContentDeleted: number;
  totalSourcesUsed: number;
  workerUptimePct: number;
  workerFailures: number;
  securityEvents: number;
  homepageChanges: number;
  pdfBase64: string;
}

export async function sendAdminWorkerMonthlyReport(
  input: AdminWorkerMonthlyReportInput,
): Promise<AdminSendOutcome> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const intro =
    `Monthly Admin Worker Report (${fmt(input.monthStart)} – ${fmt(input.monthEnd)}). ` +
    `The full daily breakdown and worker log are attached as a PDF.`;
  const filename = `admin-worker-${input.monthStart.getUTCFullYear()}-${String(
    input.monthStart.getUTCMonth() + 1,
  ).padStart(2, "0")}.pdf`;

  const sections: AdminEmailSection[] = [
    {
      title: "Monthly Summary",
      table: {
        columns: [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value", align: "right" },
        ],
        rows: [
          { metric: "Total content built", value: String(input.totalContentBuilt) },
          { metric: "Total content published", value: String(input.totalContentPublished) },
          { metric: "Total content rejected", value: String(input.totalContentRejected) },
          { metric: "Total content deleted", value: String(input.totalContentDeleted) },
          { metric: "Total sources used", value: String(input.totalSourcesUsed) },
          {
            metric: "Worker uptime",
            value: `${Math.round(input.workerUptimePct * 100)}%`,
          },
          { metric: "Worker failures", value: String(input.workerFailures) },
          { metric: "Security events", value: String(input.securityEvents) },
          { metric: "Homepage changes", value: String(input.homepageChanges) },
        ],
      },
    },
  ];

  const rendered = renderAdminEmail({
    subject: "Monthly Admin Worker Report",
    heading: "Monthly Admin Worker Report",
    intro,
    sections,
  });

  return sendAdminEmail({
    flow: "admin_worker_monthly",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
    attachments: [
      {
        filename,
        content: input.pdfBase64,
        contentType: "application/pdf",
      },
    ],
  });
}

/**
 * Fired when the Admin Worker automatically bans a confirmed brute-force
 * device. Distinct from `sendSecurityBreachAlert` (which fires for the
 * underlying event itself) so the operator can tell at a glance "the
 * worker took an automatic action" vs "a breach was logged".
 */
export interface AdminWorkerBannedDeviceInput {
  reason: string;
  route?: string;
  ipAddress?: string;
  city?: string;
  region?: string;
  country?: string;
  userAgent?: string;
  deviceCredentialFingerprint?: string;
  securityEventId?: string;
  workerActionId?: string;
  confidence: number;
}

export async function sendAdminWorkerBannedDevice(
  input: AdminWorkerBannedDeviceInput,
): Promise<AdminSendOutcome> {
  const intro =
    `The Admin Worker has automatically banned a device after confirming a brute-force ` +
    `pattern (confidence ${(input.confidence * 100).toFixed(0)}%). No further action is required.`;
  const rows: Array<{ key: string; value: string }> = [];
  rows.push({ key: "Reason", value: input.reason });
  rows.push({ key: "Time", value: new Date().toISOString() });
  rows.push({ key: "Confidence", value: `${(input.confidence * 100).toFixed(0)}%` });
  if (input.route) rows.push({ key: "Target route", value: input.route });
  if (input.ipAddress) rows.push({ key: "IP address", value: input.ipAddress });
  if (input.city) rows.push({ key: "City", value: input.city });
  if (input.region) rows.push({ key: "State / region", value: input.region });
  if (input.country) rows.push({ key: "Country", value: input.country });
  if (input.userAgent) rows.push({ key: "User-Agent", value: input.userAgent });
  if (input.deviceCredentialFingerprint)
    rows.push({ key: "Device fingerprint", value: input.deviceCredentialFingerprint });
  if (input.securityEventId) rows.push({ key: "Security event id", value: input.securityEventId });
  if (input.workerActionId)
    rows.push({ key: "Admin worker action id", value: input.workerActionId });

  const rendered = renderAdminEmail({
    subject: "Admin Worker Banned Device",
    heading: "Admin Worker Banned Device",
    intro,
    sections: [
      {
        title: "Action detail",
        table: {
          columns: [
            { key: "key", label: "Field" },
            { key: "value", label: "Value" },
          ],
          rows,
        },
      },
    ],
    signoff:
      "The ban is permanent. If this device should not be banned, remove the BannedDevice row from the database after investigating.",
  });
  return sendAdminEmail({
    flow: "admin_worker_banned_device",
    subject: rendered.subject,
    textBody: rendered.textBody,
    htmlBody: rendered.htmlBody,
  });
}
