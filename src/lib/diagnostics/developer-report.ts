/**
 * Developer Audit report service.
 *
 * Collects the diagnostic snapshots and the system logs for a selected
 * time period, redacts every secret, and lays the result out as a
 * downloadable PDF whose title is "Developer Audit". The report exists
 * so an operator can debug a system issue from one document instead of
 * paging through every admin screen.
 *
 * Report structure:
 *   • Page 1  — masthead + table of contents.
 *   • Summary — overall status and headline counts.
 *   • Diagnostics Results — every diagnostic for the period.
 *   • System Logs — every log source for the period.
 *   • Admin Navigation and Actions — admin actions for the period.
 */

import { appConfig } from "../config";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { ReportBuilder, toReportStatus, type TableCell } from "../pdf/report";
import {
  DIAGNOSTIC_ORDER,
  readDiagnosticSnapshotsInRange,
  earliestDiagnosticSnapshotAt,
  suggestedActionForDiagnostic,
  writeDiagnosticSnapshots,
  type DiagnosticSnapshotRecord,
} from "./diagnostic-snapshot";
import { redactString, redactValue } from "./redaction";
import { loadSystemHealth, type SystemHealthReport } from "./system-health";
import {
  collectSystemLogs,
  LOG_SOURCE_ORDER,
  type LogEntry,
  type LogSection,
} from "./system-log-sources";
import { readAdminActionLogsInRange } from "../audit/admin-action-log";

/** Bumped when the report layout or content materially changes. */
export const DEVELOPER_REPORT_VERSION = "1.0";

const NO_LOGS_NOTE = "No logs found for this period";

export type ReportPeriodType = "last-24-hours" | "last-7-days" | "month";

export type GenerateReportParams = {
  period: ReportPeriodType;
  /** Required when `period` is "month" — "YYYY-MM". */
  month?: string;
  adminUsername: string;
  adminUserId?: string | null;
};

export type ResolvedPeriod = {
  type: ReportPeriodType;
  label: string;
  startAt: Date;
  endAt: Date;
  /** Slug used in the downloaded file name. */
  fileSlug: string;
};

export type DeveloperReportResult =
  | {
      ok: true;
      pdf: Buffer;
      fileName: string;
      fileSize: number;
      period: ResolvedPeriod;
      generatedAt: Date;
      stats: ReportStats;
    }
  | { ok: false; failedSource: string; message: string };

export type ReportStats = {
  overallStatus: string;
  failingDiagnostics: number;
  warningDiagnostics: number;
  successfulDiagnostics: number;
  totalLogs: number;
  highestSeverity: string;
  highestSeverityCount: number;
  mostCommonErrorCategory: string;
  mostRecentFailure: string;
  mostRecentRecovery: string;
  topRecommendedAction: string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fmtTimestamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map((p) => Number(p));
  const name = MONTH_NAMES[(mon ?? 1) - 1] ?? month;
  return `${name} ${year}`;
}

/** Resolve a period selection into concrete start/end timestamps. */
export function resolveReportPeriod(
  params: Pick<GenerateReportParams, "period" | "month">,
  now: Date = new Date(),
): ResolvedPeriod {
  if (params.period === "last-24-hours") {
    return {
      type: "last-24-hours",
      label: "Last 24 Hours",
      startAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endAt: now,
      fileSlug: "last-24-hours",
    };
  }
  if (params.period === "last-7-days") {
    return {
      type: "last-7-days",
      label: "Last 7 Days",
      startAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endAt: now,
      fileSlug: "last-7-days",
    };
  }
  const month = params.month ?? now.toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`invalid month "${month}" — expected YYYY-MM`);
  }
  const [year, mon] = month.split("-").map((p) => Number(p));
  const startAt = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
  const endAt = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0) - 1);
  return {
    type: "month",
    label: monthLabel(month),
    startAt,
    endAt,
    fileSlug: month,
  };
}

/**
 * Months that have diagnostic or log data, newest first — the choices
 * the Developer Report "Month" dropdown offers the admin.
 */
export async function listAvailableReportMonths(
  now: Date = new Date(),
): Promise<Array<{ value: string; label: string }>> {
  const candidates: Array<Date | null> = [];
  try {
    candidates.push(await earliestDiagnosticSnapshotAt());
  } catch {
    candidates.push(null);
  }
  for (const query of [
    () =>
      prisma.adminActionLog.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    () =>
      prisma.securityEvent.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    () =>
      prisma.queueAuditLog.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
  ]) {
    try {
      const row = await query();
      candidates.push(row?.createdAt ?? null);
    } catch {
      candidates.push(null);
    }
  }
  const valid = candidates.filter((d): d is Date => d instanceof Date);
  const earliest =
    valid.length > 0
      ? new Date(Math.min(...valid.map((d) => d.getTime())))
      : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const months: Array<{ value: string; label: string }> = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const floor = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));
  let guard = 0;
  while (cursor.getTime() >= floor.getTime() && guard < 36) {
    const value = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ value, label: monthLabel(value) });
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    guard += 1;
  }
  return months;
}

type DiagnosticEntry = {
  key: string;
  name: string;
  status: string;
  summary: string;
  dataSource: string;
  lastUpdated: string;
  counts: string;
  errorMessage: string | null;
  suggestedAction: string | null;
  snapshotsInPeriod: number;
  worstStatus: string;
  liveFallback: boolean;
};

const SEVERITY_RANK: Record<string, number> = {
  pass: 0,
  info: 0,
  skipped: 1,
  warn: 2,
  fail: 3,
  error: 4,
};

function worstStatus(values: string[]): string {
  let worst = "pass";
  for (const value of values) {
    if ((SEVERITY_RANK[value] ?? 0) > (SEVERITY_RANK[worst] ?? 0)) worst = value;
  }
  return worst;
}

function countsToString(details: unknown): { counts: string; errorMessage: string | null } {
  if (!details || typeof details !== "object") return { counts: "—", errorMessage: null };
  const record = details as Record<string, unknown>;
  let errorMessage: string | null = null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === "errorMessage") {
      errorMessage = value ? String(value) : null;
      continue;
    }
    if (key === "lastUpdatedAt") continue;
    if (value === null || value === undefined) continue;
    parts.push(`${key}=${String(value)}`);
  }
  return { counts: parts.length > 0 ? parts.join(", ") : "—", errorMessage };
}

/**
 * Build the diagnostics list for the period — the latest snapshot per
 * diagnostic, falling back to the live diagnostic value when the
 * period predates the snapshot history.
 */
function buildDiagnosticEntries(
  snapshots: DiagnosticSnapshotRecord[],
  live: SystemHealthReport,
): DiagnosticEntry[] {
  const byKey = new Map<string, DiagnosticSnapshotRecord[]>();
  for (const snap of snapshots) {
    const list = byKey.get(snap.diagnosticKey) ?? [];
    list.push(snap);
    byKey.set(snap.diagnosticKey, list);
  }
  const liveById = new Map(live.cards.map((card) => [card.id as string, card]));
  const failing = live.cards.filter((c) => c.severity === "fail" || c.severity === "error").length;
  const warnings = live.cards.filter((c) => c.severity === "warn").length;
  const passing = live.cards.filter((c) => c.severity === "pass").length;

  const orderedKeys = [
    ...DIAGNOSTIC_ORDER.map((d) => d.key),
    ...live.cards
      .map((c) => c.id as string)
      .filter((id) => !DIAGNOSTIC_ORDER.some((d) => d.key === id)),
  ];

  const entries: DiagnosticEntry[] = [];
  for (const key of orderedKeys) {
    const known = DIAGNOSTIC_ORDER.find((d) => d.key === key);
    const inPeriod = byKey.get(key) ?? [];
    if (inPeriod.length > 0) {
      const latest = inPeriod[inPeriod.length - 1];
      const { counts, errorMessage } = countsToString(latest.detailsJson);
      entries.push({
        key,
        name: latest.diagnosticName,
        status: latest.status,
        summary: latest.summary,
        dataSource: latest.dataSource,
        lastUpdated: fmtTimestamp(latest.createdAt),
        counts,
        errorMessage,
        suggestedAction: latest.suggestedAction,
        snapshotsInPeriod: inPeriod.length,
        worstStatus: worstStatus(inPeriod.map((s) => s.status)),
        liveFallback: false,
      });
      continue;
    }
    // No snapshot in the period — fall back to the live diagnostic.
    if (key === "overall") {
      entries.push({
        key,
        name: "Overall health",
        status: live.overallSeverity,
        summary: `${live.cards.length} diagnostics — ${failing} failing, ${warnings} warning, ${passing} healthy.`,
        dataSource: "System Health aggregate",
        lastUpdated: fmtTimestamp(new Date(live.ranAt)),
        counts: `failing=${failing}, warnings=${warnings}, passing=${passing}`,
        errorMessage: null,
        suggestedAction: suggestedActionForDiagnostic("overall", live.overallSeverity),
        snapshotsInPeriod: 0,
        worstStatus: live.overallSeverity,
        liveFallback: true,
      });
      continue;
    }
    const card = liveById.get(key);
    if (!card) continue;
    const { counts } = countsToString(redactValue(card.details));
    entries.push({
      key,
      name: card.label ?? known?.name ?? key,
      status: card.severity,
      summary: card.summary,
      dataSource: card.dataSource,
      lastUpdated: fmtTimestamp(new Date(card.lastUpdatedAt)),
      counts,
      errorMessage: card.errorMessage ? redactString(card.errorMessage) : null,
      suggestedAction: suggestedActionForDiagnostic(key, card.severity),
      snapshotsInPeriod: 0,
      worstStatus: card.severity,
      liveFallback: true,
    });
  }
  return entries;
}

/** Redact every free-text and metadata field of a log entry. */
function redactLogEntry(entry: LogEntry): LogEntry {
  return {
    timestamp: entry.timestamp,
    severity: entry.severity,
    event: redactString(entry.event),
    summary: redactString(entry.summary),
    entityId: entry.entityId ?? null,
    contentType: entry.contentType ?? null,
    source: entry.source ? redactString(entry.source) : null,
    errorMessage: entry.errorMessage ? redactString(entry.errorMessage) : null,
    metadata: entry.metadata ? (redactValue(entry.metadata) as Record<string, unknown>) : null,
  };
}

function logDetail(entry: LogEntry): string {
  const parts: string[] = [];
  if (entry.entityId) parts.push(`id: ${entry.entityId}`);
  if (entry.contentType) parts.push(`type: ${entry.contentType}`);
  if (entry.source) parts.push(`source: ${entry.source}`);
  if (entry.errorMessage) parts.push(`error: ${entry.errorMessage}`);
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    const meta = Object.entries(entry.metadata)
      .slice(0, 6)
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(", ");
    if (meta) parts.push(`meta: ${meta}`);
  }
  return parts.length > 0 ? parts.join("  ·  ") : "—";
}

function computeStats(diagnostics: DiagnosticEntry[], logSections: LogSection[]): ReportStats {
  const nonOverall = diagnostics.filter((d) => d.key !== "overall");
  const failing = nonOverall.filter(
    (d) => toReportStatus(d.status) === "fail" || toReportStatus(d.status) === "error",
  ).length;
  const warnings = nonOverall.filter((d) => toReportStatus(d.status) === "warn").length;
  const passing = nonOverall.filter((d) => toReportStatus(d.status) === "pass").length;
  const overall = diagnostics.find((d) => d.key === "overall");

  const allEntries: LogEntry[] = logSections.flatMap((s) => s.entries);
  const bySeverity = (sev: string) => allEntries.filter((e) => toReportStatus(e.severity) === sev);
  let highestSeverity = "info";
  for (const sev of ["error", "fail", "warn"]) {
    if (bySeverity(sev).length > 0) {
      highestSeverity = sev;
      break;
    }
  }
  const highestSeverityCount = bySeverity(highestSeverity).length;

  const errorEntries = allEntries.filter(
    (e) => toReportStatus(e.severity) === "fail" || toReportStatus(e.severity) === "error",
  );
  const categoryCounts = new Map<string, number>();
  for (const entry of errorEntries) {
    const category = entry.event.split(/[:.]/)[0] || entry.event;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  let mostCommonErrorCategory = "None";
  let topCount = 0;
  for (const [category, count] of categoryCounts.entries()) {
    if (count > topCount) {
      topCount = count;
      mostCommonErrorCategory = `${category} (${count})`;
    }
  }

  const sortedDesc = [...allEntries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const recentFailure = sortedDesc.find(
    (e) => toReportStatus(e.severity) === "fail" || toReportStatus(e.severity) === "error",
  );
  const recentRecovery = sortedDesc.find((e) => toReportStatus(e.severity) === "pass");

  const worstFailingDiag = nonOverall.find(
    (d) => toReportStatus(d.status) === "fail" || toReportStatus(d.status) === "error",
  );
  const topRecommendedAction =
    worstFailingDiag?.suggestedAction ??
    overall?.suggestedAction ??
    nonOverall.find((d) => toReportStatus(d.status) === "warn")?.suggestedAction ??
    "No action required — all diagnostics are healthy.";

  return {
    overallStatus: overall?.status ?? "unknown",
    failingDiagnostics: failing,
    warningDiagnostics: warnings,
    successfulDiagnostics: passing,
    totalLogs: allEntries.length,
    highestSeverity,
    highestSeverityCount,
    mostCommonErrorCategory,
    mostRecentFailure: recentFailure
      ? `${recentFailure.event} at ${fmtTimestamp(recentFailure.timestamp)}`
      : "None in period",
    mostRecentRecovery: recentRecovery
      ? `${recentRecovery.event} at ${fmtTimestamp(recentRecovery.timestamp)}`
      : "None in period",
    topRecommendedAction,
  };
}

/**
 * Generate the Developer Audit PDF for the selected period. Every
 * collection step is contained: a single broken source becomes a noted
 * empty section instead of sinking the whole report. Only an outright
 * PDF-build failure yields `{ ok: false }`.
 */
export async function generateDeveloperReport(
  params: GenerateReportParams,
): Promise<DeveloperReportResult> {
  const generatedAt = new Date();
  let period: ResolvedPeriod;
  try {
    period = resolveReportPeriod(params, generatedAt);
  } catch (error) {
    return {
      ok: false,
      failedSource: "period",
      message: error instanceof Error ? error.message : "invalid period",
    };
  }

  // Generating the report counts as running diagnostics — record a
  // fresh snapshot set, and reuse the live report for fallbacks.
  let live: SystemHealthReport;
  try {
    const written = await writeDiagnosticSnapshots();
    live = written ?? (await loadSystemHealth());
  } catch (error) {
    return {
      ok: false,
      failedSource: "Diagnostics Results",
      message: error instanceof Error ? error.message : "failed to load diagnostics",
    };
  }

  let snapshots: DiagnosticSnapshotRecord[] = [];
  try {
    snapshots = await readDiagnosticSnapshotsInRange(period.startAt, period.endAt);
  } catch (error) {
    logger.warn("developer_report.snapshot_read_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const diagnostics = buildDiagnosticEntries(snapshots, live);

  const logSections = (await collectSystemLogs(period.startAt, period.endAt)).map((section) => ({
    ...section,
    entries: section.entries.map(redactLogEntry),
  }));

  let adminActions: Awaited<ReturnType<typeof readAdminActionLogsInRange>> = [];
  let adminActionsError: string | null = null;
  try {
    adminActions = await readAdminActionLogsInRange(period.startAt, period.endAt);
  } catch (error) {
    adminActionsError = error instanceof Error ? error.message : String(error);
  }

  const stats = computeStats(diagnostics, logSections);

  try {
    const pdf = renderReportPdf({
      period,
      generatedAt,
      diagnostics,
      logSections,
      adminActions,
      adminActionsError,
      stats,
    });
    const fileName = `developer-audit-${period.fileSlug}.pdf`;
    return {
      ok: true,
      pdf,
      fileName,
      fileSize: pdf.length,
      period,
      generatedAt,
      stats,
    };
  } catch (error) {
    return {
      ok: false,
      failedSource: "PDF layout",
      message: error instanceof Error ? error.message : "failed to render PDF",
    };
  }
}

function renderReportPdf(input: {
  period: ResolvedPeriod;
  generatedAt: Date;
  diagnostics: DiagnosticEntry[];
  logSections: LogSection[];
  adminActions: Awaited<ReturnType<typeof readAdminActionLogsInRange>>;
  adminActionsError: string | null;
  stats: ReportStats;
}): Buffer {
  const { period, generatedAt, diagnostics, logSections, adminActions, adminActionsError, stats } =
    input;

  const report = new ReportBuilder({
    reportTitle: "Developer Audit",
    period: period.label,
    generatedAt: fmtTimestamp(generatedAt),
    environment: process.env.NODE_ENV ?? "development",
    appName: appConfig.email.fromName,
    dashboardSection: "Admin · Diagnostics",
    reportVersion: DEVELOPER_REPORT_VERSION,
  });

  // ── Summary ──────────────────────────────────────────────────────
  report.section("Summary", "Section 1");
  report.paragraph(
    "Headline status for the selected period. Read this first, then drill into " +
      "the Diagnostics Results and System Logs sections for the detail behind each number.",
  );
  report.statusLine(`Overall status — ${period.label}`, toReportStatus(stats.overallStatus));
  report.keyValue([
    { label: "Overall status", value: stats.overallStatus },
    { label: "Failing diagnostics", value: String(stats.failingDiagnostics) },
    { label: "Warnings", value: String(stats.warningDiagnostics) },
    { label: "Successful diagnostics", value: String(stats.successfulDiagnostics) },
    { label: "Total logs included", value: String(stats.totalLogs) },
    {
      label: "Highest severity log count",
      value: `${stats.highestSeverityCount} ${stats.highestSeverity}-level`,
    },
    { label: "Most common error category", value: stats.mostCommonErrorCategory },
    { label: "Most recent failure", value: stats.mostRecentFailure },
    { label: "Most recent recovery", value: stats.mostRecentRecovery },
    { label: "Top recommended next action", value: stats.topRecommendedAction },
  ]);

  // ── Diagnostics Results ──────────────────────────────────────────
  report.section("Diagnostics Results", "Section 2");
  report.paragraph(
    "Every diagnostic card for the selected period, in the order of the admin " +
      "Diagnostics panel. Each entry shows the latest recorded snapshot; when the " +
      "period predates the diagnostic history the live value is used and labelled.",
  );
  for (const diag of diagnostics) {
    report.statusLine(diag.name, toReportStatus(diag.status));
    const rows = [
      { label: "Status", value: diag.status },
      { label: "Summary", value: diag.summary },
      { label: "Data source", value: diag.dataSource },
      { label: "Last updated", value: diag.lastUpdated },
      { label: "Relevant counts", value: diag.counts },
    ];
    if (diag.errorMessage) rows.push({ label: "Error message", value: diag.errorMessage });
    if (diag.suggestedAction)
      rows.push({ label: "Suggested next action", value: diag.suggestedAction });
    rows.push({
      label: "Snapshots in period",
      value: diag.liveFallback
        ? "0 — live value (period predates diagnostic history)"
        : `${diag.snapshotsInPeriod} (worst status: ${diag.worstStatus})`,
    });
    report.keyValue(rows);
    report.spacer(4);
  }

  // ── System Logs ──────────────────────────────────────────────────
  report.section("System Logs", "Section 3");
  report.paragraph(
    "All relevant logs available for the selected period, one subsection per log " +
      "source. Secrets are redacted before this report is generated. A subsection " +
      `with no rows in the period is included and marked "${NO_LOGS_NOTE}".`,
  );
  const sectionByKey = new Map(logSections.map((s) => [s.key, s]));
  for (const { key, name } of LOG_SOURCE_ORDER) {
    report.subsection(name);
    const section = sectionByKey.get(key);
    if (!section) {
      report.note(NO_LOGS_NOTE);
      continue;
    }
    if (section.error) {
      report.note(`Failed to load this log source: ${redactString(section.error)}`);
      continue;
    }
    if (section.entries.length === 0) {
      report.note(NO_LOGS_NOTE);
      continue;
    }
    report.paragraph(
      `${section.entries.length} log ${section.entries.length === 1 ? "entry" : "entries"} in this period.`,
    );
    const rows: TableCell[][] = section.entries.map((entry) => [
      fmtTimestamp(entry.timestamp),
      { badge: entry.severity },
      entry.event,
      entry.summary,
      logDetail(entry),
    ]);
    report.table(
      [
        { header: "Timestamp", weight: 17 },
        { header: "Severity", weight: 9 },
        { header: "Event", weight: 18 },
        { header: "Summary", weight: 26 },
        { header: "Detail", weight: 30 },
      ],
      rows,
    );
  }

  // ── Admin Navigation and Actions ─────────────────────────────────
  report.section("Admin Navigation and Actions", "Section 4");
  report.paragraph(
    "Admin actions taken during the selected period — logins, logouts, diagnostics " +
      "runs, report downloads, cleanup, ingestion, queue repair, and other admin " +
      "actions. Valid authenticated admin activity is recorded here without raising " +
      "a suspicious-activity alert.",
  );
  if (adminActionsError) {
    report.note(`Failed to load admin actions: ${redactString(adminActionsError)}`);
  } else if (adminActions.length === 0) {
    report.note(NO_LOGS_NOTE);
  } else {
    const counts = new Map<string, number>();
    for (const action of adminActions) {
      counts.set(action.actionType, (counts.get(action.actionType) ?? 0) + 1);
    }
    report.subheading("Action summary");
    report.keyValue(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ label: type, value: String(count) })),
    );
    report.subheading("Action log");
    const rows: TableCell[][] = adminActions
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((action) => [
        fmtTimestamp(action.createdAt),
        action.adminUsername,
        action.actionType,
        {
          badge:
            action.result === "success" ? "pass" : action.result === "failure" ? "fail" : "info",
        },
        action.route ?? "—",
      ]);
    report.table(
      [
        { header: "Timestamp", weight: 20 },
        { header: "Admin", weight: 16 },
        { header: "Action", weight: 24 },
        { header: "Result", weight: 12 },
        { header: "Route", weight: 28 },
      ],
      rows,
    );
  }

  return report.build();
}
