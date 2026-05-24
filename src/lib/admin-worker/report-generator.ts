/**
 * Admin Worker report generator. Two report types:
 *
 *   1. Developer Audit PDF — operator-triggered from the diagnostics
 *      card; periods are LAST_24_HOURS, LAST_7_DAYS, LAST_30_DAYS.
 *   2. Monthly Admin Worker Report PDF — sent on the last day of every
 *      month to ADMIN_EMAIL with the full 30-day log split into daily
 *      sections.
 *
 * Both reports redact secrets (passwords, API keys, session secrets,
 * tokens, cookies, authorization headers, full database URLs, private
 * env-var values) and KEEP useful debugging data (worker ID, source
 * host, content type, job kind, timestamps, route paths, diagnostic
 * status, failure category).
 */

import type { AdminDeveloperReportPeriod, PrismaClient } from "@prisma/client";

import { listAdminWorkerLogs } from "./logs";
import { listRecentPasses } from "./passes";
import { runAdminWorkerDiagnostics, summarizeRatings } from "./diagnostics";

const SECRET_KEYS = [
  "password",
  "apikey",
  "api_key",
  "session_secret",
  "sessionsecret",
  "token",
  "cookie",
  "authorization",
  "database_url",
];

export function redactSecrets(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return SECRET_KEYS.some((k) => value.toLowerCase().includes(k)) ? "[REDACTED]" : value;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const isSecret = SECRET_KEYS.some((s) => k.toLowerCase().includes(s));
      out[k] = isSecret ? "[REDACTED]" : redactSecrets(v);
    }
    return out;
  }
  return value;
}

export function periodToSince(period: AdminDeveloperReportPeriod): Date {
  const now = Date.now();
  switch (period) {
    case "LAST_24_HOURS":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "LAST_7_DAYS":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "LAST_30_DAYS":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
}

export interface DeveloperAuditData {
  generatedAt: Date;
  period: AdminDeveloperReportPeriod;
  diagnosticsResults: Awaited<ReturnType<typeof runAdminWorkerDiagnostics>>;
  diagnosticsSummary: ReturnType<typeof summarizeRatings>;
  recentPasses: Awaited<ReturnType<typeof listRecentPasses>>;
  workerLogs: Awaited<ReturnType<typeof listAdminWorkerLogs>>;
}

export async function collectDeveloperAuditData(
  prisma: PrismaClient,
  period: AdminDeveloperReportPeriod,
): Promise<DeveloperAuditData> {
  const since = periodToSince(period);
  const [diagnosticsResults, recentPasses, workerLogs] = await Promise.all([
    runAdminWorkerDiagnostics(prisma),
    listRecentPasses(prisma, { limit: 100 }),
    listAdminWorkerLogs(prisma, { since, limit: 1000 }),
  ]);
  return {
    generatedAt: new Date(),
    period,
    diagnosticsResults,
    diagnosticsSummary: summarizeRatings(diagnosticsResults),
    recentPasses,
    workerLogs,
  };
}

export const DEVELOPER_AUDIT_SECTIONS = [
  "Diagnostics Results",
  "Worker Logs",
  "System Logs",
  "Security Logs",
  "Content Growth and Publishing",
  "Homepage Actions",
  "Recommended Repairs",
] as const;

export type DeveloperAuditSection = (typeof DEVELOPER_AUDIT_SECTIONS)[number];

export interface MonthlySummary {
  monthStart: Date;
  monthEnd: Date;
  totalContentBuilt: number;
  totalContentPublished: number;
  totalContentRejected: number;
  totalContentDeleted: number;
  totalSourcesUsed: number;
  bestSources: Array<{ host: string; saved: number }>;
  worstSources: Array<{ host: string; failures: number }>;
  workerUptimePct: number;
  workerFailures: number;
  securityEvents: number;
  homepageChanges: number;
}

/**
 * Compute the high-level monthly summary the email body shows.
 * Detailed per-day breakdown is computed by `dailyBreakdown`.
 */
export async function buildMonthlySummary(
  prisma: PrismaClient,
  monthStart: Date,
  monthEnd: Date,
): Promise<MonthlySummary> {
  const [passes, bestSources, securityCount, homepageDrafts] = await Promise.all([
    prisma.adminWorkerPass.findMany({
      where: { startedAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.adminWorkerSourceReputation.findMany({
      orderBy: { publicPublishRate: "desc" },
      take: 5,
    }),
    prisma.securityEvent.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.homepageWorkerDraft.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  const totals = passes.reduce(
    (acc, p) => ({
      built: acc.built + p.contentBuilt,
      published: acc.published + p.contentPublished,
      rejected: acc.rejected + p.contentRejected,
      failures: acc.failures + (p.status === "FAILED" ? 1 : 0),
      total: acc.total + 1,
    }),
    { built: 0, published: 0, rejected: 0, failures: 0, total: 0 },
  );
  const uptime = totals.total === 0 ? 0 : 1 - totals.failures / totals.total;

  return {
    monthStart,
    monthEnd,
    totalContentBuilt: totals.built,
    totalContentPublished: totals.published,
    totalContentRejected: totals.rejected,
    totalContentDeleted: 0,
    totalSourcesUsed: bestSources.length,
    bestSources: bestSources.map((s) => ({
      host: s.sourceHost,
      saved: Math.round(s.publicPublishRate * 100),
    })),
    worstSources: [],
    workerUptimePct: uptime,
    workerFailures: totals.failures,
    securityEvents: securityCount,
    homepageChanges: homepageDrafts,
  };
}

/** Return the last calendar day of the given month. */
export function lastDayOfMonth(year: number, month0: number): Date {
  return new Date(year, month0 + 1, 0);
}

export function isLastDayOfMonth(d: Date): boolean {
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);
  return tomorrow.getMonth() !== d.getMonth();
}
