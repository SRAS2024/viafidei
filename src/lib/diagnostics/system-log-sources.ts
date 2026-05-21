/**
 * System log collectors for the Developer Audit report.
 *
 * Each of the report's "System Logs" subsections is backed by one
 * collector here. A collector queries a durable table for the rows
 * inside the selected time window and normalises them to a uniform
 * `LogEntry` shape so the PDF layer can render every subsection the
 * same way.
 *
 * A collector never throws: a failed query yields a `LogSection` with
 * an `error` string instead of entries, so one broken source cannot
 * sink the whole report. A source with no durable table (cache health,
 * search verification, …) — or simply no rows in the window — yields
 * an empty section the report marks "No logs found for this period".
 */

import { prisma } from "../db/client";

/** Per-source row cap so an enormous window cannot explode the PDF. */
const PER_SOURCE_LIMIT = 400;

export type LogEntry = {
  timestamp: Date;
  /** Normalised severity — "info" | "warn" | "fail" | "error" | "pass". */
  severity: string;
  event: string;
  summary: string;
  entityId?: string | null;
  contentType?: string | null;
  source?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LogSection = {
  key: string;
  name: string;
  entries: LogEntry[];
  /** Present when the underlying query failed. */
  error?: string;
};

type Range = { startAt: Date; endAt: Date };

async function safeCollect(
  key: string,
  name: string,
  collect: () => Promise<LogEntry[]>,
): Promise<LogSection> {
  try {
    const entries = await collect();
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { key, name, entries };
  } catch (error) {
    return {
      key,
      name,
      entries: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function asMeta(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// ─── Collectors ─────────────────────────────────────────────────────

async function queueJobLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.ingestionJobQueue.findMany({
    where: { createdAt: { gte: startAt, lte: endAt } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity:
      r.status === "failed"
        ? "fail"
        : r.status === "retrying"
          ? "warn"
          : r.status === "completed"
            ? "pass"
            : "info",
    event: `${r.jobKind}:${r.status}`,
    summary: `${r.jobName} (${r.status}, attempt ${r.attempts}/${r.maxAttempts})`,
    entityId: r.id,
    contentType: r.contentType,
    source: r.sourceId,
    errorMessage: r.errorMessage ?? r.lastError ?? null,
  }));
}

async function workerHeartbeatLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.workerHeartbeat.findMany({
    where: { lastHeartbeatAt: { gte: startAt, lte: endAt } },
    orderBy: { lastHeartbeatAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.lastHeartbeatAt,
    severity: r.failedCount > 0 ? "warn" : "info",
    event: `worker:${r.status}`,
    summary: `Worker ${r.workerId} — processed ${r.processedCount}, failed ${r.failedCount}, retries ${r.retryCount}`,
    entityId: r.workerId,
    source: r.hostname,
    metadata: asMeta(r.metadata),
  }));
}

async function sourceDiscoveryLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.discoveredSourceItem.findMany({
    where: { discoveredAt: { gte: startAt, lte: endAt } },
    orderBy: { discoveredAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.discoveredAt,
    severity: r.status === "failed" ? "fail" : r.status === "skipped" ? "warn" : "info",
    event: `discovery:${r.status}`,
    summary: `${r.adapterKey} discovered ${r.externalKey}`,
    entityId: r.id,
    contentType: r.contentType,
    source: r.sourceUrl ?? r.sourceId,
    errorMessage: r.failureReason ?? null,
  }));
}

async function sourceFetchLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.sourceDocument.findMany({
    where: { fetchedAt: { gte: startAt, lte: endAt } },
    orderBy: { fetchedAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.fetchedAt,
    severity: r.fetchStatus === "ok" ? "pass" : "fail",
    event: `source_fetch:${r.fetchStatus}`,
    summary: `Fetched ${r.sourceUrl}${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ""}`,
    entityId: r.id,
    source: r.sourceHost,
    errorMessage: r.fetchStatus === "ok" ? null : `fetch status ${r.fetchStatus}`,
  }));
}

async function sourceDocumentLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.sourceDocument.findMany({
    where: { fetchedAt: { gte: startAt, lte: endAt } },
    orderBy: { fetchedAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.fetchedAt,
    severity: r.fetchStatus === "ok" ? "pass" : "warn",
    event: "source_document",
    summary: `${r.sourceTitle ?? "Untitled document"} — ${r.language ?? "unknown language"}`,
    entityId: r.id,
    source: r.sourceHost,
    metadata: { checksum: r.contentChecksum ?? null, workerJobId: r.workerJobId ?? null },
  }));
}

async function contentBuildLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.contentPackageBuildLog.findMany({
    where: { createdAt: { gte: startAt, lte: endAt } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: r.buildStatus === "built_complete_package" ? "pass" : "fail",
    event: `build:${r.buildStatus}`,
    summary: `${r.builderName} v${r.builderVersion} built ${r.candidateSlug ?? "candidate"}`,
    entityId: r.contentRef ?? r.id,
    contentType: r.contentType,
    source: r.sourceHost,
    errorMessage: r.failureReason ?? null,
  }));
}

async function chainAuditLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.queueAuditLog.findMany({
    where: { createdAt: { gte: startAt, lte: endAt }, event: { startsWith: "chain." } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: /fail|reject|error/i.test(r.event)
      ? "fail"
      : /pass|succeed|complete/i.test(r.event)
        ? "pass"
        : "info",
    event: r.event,
    summary: r.reason ?? `${r.fromStatus ?? "?"} → ${r.toStatus ?? "?"}`,
    entityId: r.jobQueueId,
    source: r.workerId,
    metadata: asMeta(r.metadata),
  }));
}

async function strictQaLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.rejectedContentLog.findMany({
    where: { deletedAt: { gte: startAt, lte: endAt } },
    orderBy: { deletedAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.deletedAt,
    severity: r.decision === "delete" ? "fail" : "warn",
    event: `strict_qa:${r.decision}`,
    summary: `${r.failedContractName ?? "contract"} rejected ${r.slug ?? r.originalTitle ?? "row"}`,
    entityId: r.id,
    contentType: r.contentType,
    source: r.sourceHost,
    errorMessage: r.rejectionReason,
  }));
}

async function rejectedContentLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.rejectedContentLog.findMany({
    where: { deletedAt: { gte: startAt, lte: endAt } },
    orderBy: { deletedAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.deletedAt,
    severity: "warn",
    event: `rejected:${r.failureCategory ?? "unknown"}`,
    summary: `${r.contentType} "${r.originalTitle ?? r.slug ?? "row"}" — ${r.rejectionReason}`,
    entityId: r.id,
    contentType: r.contentType,
    source: r.sourceHost ?? r.sourceUrl,
    errorMessage: r.rejectionReason,
  }));
}

async function persistenceLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.queueAuditLog.findMany({
    where: { createdAt: { gte: startAt, lte: endAt }, event: { contains: "persist" } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: /fail|error/i.test(r.event) ? "fail" : "pass",
    event: r.event,
    summary: r.reason ?? `${r.fromStatus ?? "?"} → ${r.toStatus ?? "?"}`,
    entityId: r.jobQueueId,
    source: r.workerId,
    metadata: asMeta(r.metadata),
  }));
}

async function cleanupLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const [management, archive] = await Promise.all([
    prisma.dataManagementLog.findMany({
      where: { createdAt: { gte: startAt, lte: endAt }, action: "CLEANUP" },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE_LIMIT,
    }),
    prisma.archiveDeletionLog.findMany({
      where: { deletedAt: { gte: startAt, lte: endAt } },
      orderBy: { deletedAt: "desc" },
      take: PER_SOURCE_LIMIT,
    }),
  ]);
  const fromManagement: LogEntry[] = management.map((r) => ({
    timestamp: r.createdAt,
    severity: "info",
    event: "cleanup",
    summary: r.reason ?? `Cleanup of ${r.contentType}`,
    entityId: r.contentRef,
    contentType: r.contentType,
    source: r.triggeredBy,
  }));
  const fromArchive: LogEntry[] = archive.map((r) => ({
    timestamp: r.deletedAt,
    severity: "info",
    event: "archive_delete",
    summary: `${r.contentType} ${r.contentSlug ?? r.contentId} permanently deleted`,
    entityId: r.contentId,
    contentType: r.contentType,
    source: r.triggeredBy,
    errorMessage: r.reason ?? null,
  }));
  return [...fromManagement, ...fromArchive];
}

async function schedulerLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.queueAuditLog.findMany({
    where: { createdAt: { gte: startAt, lte: endAt }, event: { startsWith: "scheduler." } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: /fail|error/i.test(r.event) ? "fail" : "pass",
    event: r.event,
    summary: r.reason ?? "Scheduler tick",
    entityId: r.jobQueueId,
    source: r.workerId,
    metadata: asMeta(r.metadata),
  }));
}

async function securityEventLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.securityEvent.findMany({
    where: { createdAt: { gte: startAt, lte: endAt } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity:
      r.classification === "Breach" || r.severity === "critical"
        ? "error"
        : r.severity === "error"
          ? "fail"
          : r.severity === "warning"
            ? "warn"
            : "info",
    event: r.eventType,
    summary: `${r.classification} — ${r.attemptedAction ?? r.eventType}${r.emailSent ? " (email sent)" : ""}`,
    entityId: r.id,
    source: r.targetRoute,
    errorMessage: r.automaticActionTaken ?? null,
    metadata: {
      classification: r.classification,
      httpMethod: r.httpMethod ?? null,
      country: r.country ?? null,
      adminAccount: r.adminAccount,
    },
  }));
}

async function bannedDeviceLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.bannedDevice.findMany({
    where: { createdAt: { gte: startAt, lte: endAt } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: r.active ? "error" : "warn",
    event: `banned_device:${r.banReason}`,
    summary: `Device banned (${r.createdBy}); active=${r.active}`,
    entityId: r.id,
    source: r.securityEventId,
  }));
}

async function diagnosticSnapshotLogs(
  { startAt, endAt }: Range,
  diagnosticKey: string,
): Promise<LogEntry[]> {
  const rows = await prisma.diagnosticSnapshot.findMany({
    where: { createdAt: { gte: startAt, lte: endAt }, diagnosticKey },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: r.status,
    event: `${r.diagnosticKey}:${r.status}`,
    summary: r.summary,
    entityId: r.id,
    source: r.dataSource,
    metadata: asMeta(r.detailsJson),
  }));
}

async function sitemapRefreshLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.queueAuditLog.findMany({
    where: { createdAt: { gte: startAt, lte: endAt }, event: { contains: "sitemap" } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: /fail|error/i.test(r.event) ? "fail" : "pass",
    event: r.event,
    summary: r.reason ?? "Sitemap refreshed",
    entityId: r.jobQueueId,
    metadata: asMeta(r.metadata),
  }));
}

async function adminActionLogs({ startAt, endAt }: Range): Promise<LogEntry[]> {
  const rows = await prisma.adminActionLog.findMany({
    where: { createdAt: { gte: startAt, lte: endAt } },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt,
    severity: r.result === "success" ? "pass" : r.result === "failure" ? "fail" : "info",
    event: r.actionType,
    summary: `${r.adminUsername} — ${r.actionType} (${r.result})`,
    entityId: r.id,
    source: r.route,
    metadata: asMeta(r.metadataJson),
  }));
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Ordered list of the report's System Logs subsections. The order is
 * the order they appear in the PDF.
 */
export const LOG_SOURCE_ORDER: ReadonlyArray<{ key: string; name: string }> = [
  { key: "queue", name: "Queue job logs" },
  { key: "worker", name: "Worker heartbeat logs" },
  { key: "source_discovery", name: "Source discovery logs" },
  { key: "source_fetch", name: "Source fetch logs" },
  { key: "source_document", name: "Source document logs" },
  { key: "content_build", name: "Content package build logs" },
  { key: "chain_audit", name: "Content factory chain audit logs" },
  { key: "strict_qa", name: "Strict QA logs" },
  { key: "rejected_content", name: "Rejected content logs" },
  { key: "persistence", name: "Persistence logs" },
  { key: "cleanup", name: "Cleanup logs" },
  { key: "scheduler", name: "Scheduler logs" },
  { key: "security", name: "Security event logs" },
  { key: "banned_device", name: "Banned device logs" },
  { key: "admin_email", name: "Admin email logs" },
  { key: "database", name: "Database diagnostic logs" },
  { key: "cache_health", name: "Cache health logs" },
  { key: "sitemap", name: "Sitemap refresh logs" },
  { key: "search_verification", name: "Search verification logs" },
  { key: "admin_action", name: "Admin action logs" },
];

/**
 * Collect every System Logs subsection for the window. Sources with no
 * durable per-period table (cache health, search verification) return
 * an empty section the report marks "No logs found for this period".
 */
export async function collectSystemLogs(startAt: Date, endAt: Date): Promise<LogSection[]> {
  const range: Range = { startAt, endAt };
  return Promise.all([
    safeCollect("queue", "Queue job logs", () => queueJobLogs(range)),
    safeCollect("worker", "Worker heartbeat logs", () => workerHeartbeatLogs(range)),
    safeCollect("source_discovery", "Source discovery logs", () => sourceDiscoveryLogs(range)),
    safeCollect("source_fetch", "Source fetch logs", () => sourceFetchLogs(range)),
    safeCollect("source_document", "Source document logs", () => sourceDocumentLogs(range)),
    safeCollect("content_build", "Content package build logs", () => contentBuildLogs(range)),
    safeCollect("chain_audit", "Content factory chain audit logs", () => chainAuditLogs(range)),
    safeCollect("strict_qa", "Strict QA logs", () => strictQaLogs(range)),
    safeCollect("rejected_content", "Rejected content logs", () => rejectedContentLogs(range)),
    safeCollect("persistence", "Persistence logs", () => persistenceLogs(range)),
    safeCollect("cleanup", "Cleanup logs", () => cleanupLogs(range)),
    safeCollect("scheduler", "Scheduler logs", () => schedulerLogs(range)),
    safeCollect("security", "Security event logs", () => securityEventLogs(range)),
    safeCollect("banned_device", "Banned device logs", () => bannedDeviceLogs(range)),
    safeCollect("admin_email", "Admin email logs", () =>
      diagnosticSnapshotLogs(range, "admin_email"),
    ),
    safeCollect("database", "Database diagnostic logs", () =>
      diagnosticSnapshotLogs(range, "database"),
    ),
    safeCollect("cache_health", "Cache health logs", async () => []),
    safeCollect("sitemap", "Sitemap refresh logs", () => sitemapRefreshLogs(range)),
    safeCollect("search_verification", "Search verification logs", async () => []),
    safeCollect("admin_action", "Admin action logs", () => adminActionLogs(range)),
  ]);
}
