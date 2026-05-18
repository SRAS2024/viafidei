/**
 * System-health dashboard helper. Returns one health card per
 * spec-required diagnostic category, every card carrying:
 *
 *   * id              — stable identifier
 *   * label           — human-readable card title
 *   * severity        — pass / warn / fail / error
 *   * lastUpdatedAt   — when the underlying signal was last observed
 *   * dataSource      — which DB table / service feeds the card,
 *                       displayed as a "data source" badge so the
 *                       admin can see at a glance where a number
 *                       came from
 *   * summary         — one-line description
 *   * details         — small structured payload of counts / IDs
 *   * errorMessage    — when the underlying query failed (instead
 *                       of returning a false zero, the card shows
 *                       an error state)
 *
 * The 14 cards the spec lists:
 *   queue, worker, source_discovery, source_fetch, source_document,
 *   content_factory, builder, strict_qa, persistence, cleanup,
 *   growth, security, admin_email, database.
 *
 * Every card is fetched in parallel and the overall result is
 * pinned to the worst severity, so the admin landing surface can
 * highlight the worst category at the top.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { hasHealthyWorker } from "../ingestion/queue/heartbeat";

export type HealthSeverity = "pass" | "warn" | "fail" | "error";

export type HealthCardId =
  | "queue"
  | "worker"
  | "source_discovery"
  | "source_fetch"
  | "source_document"
  | "content_factory"
  | "builder"
  | "strict_qa"
  | "persistence"
  | "cleanup"
  | "growth"
  | "security"
  | "admin_email"
  | "database";

export type HealthCard = {
  id: HealthCardId;
  label: string;
  severity: HealthSeverity;
  /** ISO timestamp of when this card's data was observed. */
  lastUpdatedAt: string;
  /** Table or module the card reads from — shown as a "data source" badge. */
  dataSource: string;
  summary: string;
  /** Small structured payload of counts / IDs / etc. */
  details: Record<string, string | number | boolean | null>;
  /** When the underlying query failed — shown as an error state. */
  errorMessage?: string;
};

export type SystemHealthReport = {
  /** Worst severity across every card. Useful for the navbar badge. */
  overallSeverity: HealthSeverity;
  ranAt: string;
  cards: HealthCard[];
};

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  pass: 0,
  warn: 1,
  fail: 2,
  error: 3,
};

function worst(severities: HealthSeverity[]): HealthSeverity {
  let out: HealthSeverity = "pass";
  for (const s of severities) {
    if (SEVERITY_RANK[s] > SEVERITY_RANK[out]) out = s;
  }
  return out;
}

async function safeRun<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function errorCard(args: {
  id: HealthCardId;
  label: string;
  dataSource: string;
  error: string;
}): HealthCard {
  return {
    id: args.id,
    label: args.label,
    severity: "error",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: args.dataSource,
    summary: `Query failed — value unknown (NOT a real zero)`,
    details: {},
    errorMessage: args.error,
  };
}

// ─── Per-card collectors ────────────────────────────────────────────

async function queueCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const rows = await prisma.ingestionJobQueue.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts = Object.fromEntries(rows.map((r) => [r.status, r._count?._all ?? 0]));
    return counts as Record<string, number>;
  });
  if (!result.ok) {
    return errorCard({
      id: "queue",
      label: "Queue health",
      dataSource: "IngestionJobQueue",
      error: result.error,
    });
  }
  const failed = result.value.failed ?? 0;
  return {
    id: "queue",
    label: "Queue health",
    severity: failed > 50 ? "warn" : "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "IngestionJobQueue",
    summary: `pending=${result.value.pending ?? 0} running=${result.value.running ?? 0} failed=${failed}`,
    details: result.value,
  };
}

async function workerCard(): Promise<HealthCard> {
  const healthy = await safeRun(async () => hasHealthyWorker());
  const lastBeat = await safeRun(() =>
    prisma.workerHeartbeat.findFirst({ orderBy: { lastHeartbeatAt: "desc" } }),
  );
  if (!healthy.ok || !lastBeat.ok) {
    return errorCard({
      id: "worker",
      label: "Worker health",
      dataSource: "WorkerHeartbeat",
      error: (healthy.ok ? "" : healthy.error) || (lastBeat.ok ? "" : lastBeat.error),
    });
  }
  const beat = lastBeat.value;
  return {
    id: "worker",
    label: "Worker health",
    severity: healthy.value ? "pass" : "fail",
    lastUpdatedAt: beat ? beat.lastHeartbeatAt.toISOString() : new Date().toISOString(),
    dataSource: "WorkerHeartbeat",
    summary: healthy.value
      ? `Worker ${beat?.workerId ?? "unknown"} is alive`
      : "No healthy worker heartbeat",
    details: {
      lastHeartbeatAt: beat ? beat.lastHeartbeatAt.toISOString() : null,
      workerId: beat?.workerId ?? null,
      processedCount: beat?.processedCount ?? null,
      failedCount: beat?.failedCount ?? null,
    },
  };
}

async function sourceDiscoveryCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const total = await prisma.discoveredSourceItem.count({});
    const latest = await prisma.discoveredSourceItem.findFirst({
      orderBy: { discoveredAt: "desc" },
    });
    return { total, latest };
  });
  if (!result.ok) {
    return errorCard({
      id: "source_discovery",
      label: "Source discovery health",
      dataSource: "DiscoveredSourceItem",
      error: result.error,
    });
  }
  return {
    id: "source_discovery",
    label: "Source discovery health",
    severity: "pass",
    lastUpdatedAt: result.value.latest
      ? result.value.latest.discoveredAt.toISOString()
      : new Date().toISOString(),
    dataSource: "DiscoveredSourceItem",
    summary: `discovered total=${result.value.total}`,
    details: { total: result.value.total },
  };
}

async function sourceFetchCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const total = await prisma.sourceDocument.count({});
    const latest = await prisma.sourceDocument.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true, sourceUrl: true, fetchStatus: true },
    });
    return { total, latest };
  });
  if (!result.ok) {
    return errorCard({
      id: "source_fetch",
      label: "Source fetch health",
      dataSource: "SourceDocument",
      error: result.error,
    });
  }
  return {
    id: "source_fetch",
    label: "Source fetch health",
    severity: "pass",
    lastUpdatedAt: result.value.latest
      ? result.value.latest.fetchedAt.toISOString()
      : new Date().toISOString(),
    dataSource: "SourceDocument",
    summary: `documents total=${result.value.total}`,
    details: {
      total: result.value.total,
      lastFetchStatus: result.value.latest?.fetchStatus ?? null,
    },
  };
}

async function sourceDocumentCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const okCount = await prisma.sourceDocument.count({ where: { fetchStatus: "ok" } });
    const totalCount = await prisma.sourceDocument.count({});
    return { okCount, totalCount };
  });
  if (!result.ok) {
    return errorCard({
      id: "source_document",
      label: "Source document health",
      dataSource: "SourceDocument",
      error: result.error,
    });
  }
  const failRate =
    result.value.totalCount > 0 ? 1 - result.value.okCount / result.value.totalCount : 0;
  return {
    id: "source_document",
    label: "Source document health",
    severity: failRate > 0.2 ? "warn" : "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "SourceDocument",
    summary: `ok=${result.value.okCount}/${result.value.totalCount} (fail-rate ${(failRate * 100).toFixed(1)}%)`,
    details: {
      ok: result.value.okCount,
      total: result.value.totalCount,
    },
  };
}

async function contentFactoryCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const builds = await prisma.contentPackageBuildLog.groupBy({
      by: ["buildStatus"],
      _count: { _all: true },
    });
    return Object.fromEntries(builds.map((b) => [b.buildStatus, b._count?._all ?? 0])) as Record<
      string,
      number
    >;
  });
  if (!result.ok) {
    return errorCard({
      id: "content_factory",
      label: "Content factory health",
      dataSource: "ContentPackageBuildLog",
      error: result.error,
    });
  }
  const built = result.value.built_complete_package ?? 0;
  const failed = Object.entries(result.value)
    .filter(([k]) => k !== "built_complete_package")
    .reduce((s, [, v]) => s + v, 0);
  const failRate = built + failed > 0 ? failed / (built + failed) : 0;
  return {
    id: "content_factory",
    label: "Content factory health",
    severity: failRate > 0.5 ? "warn" : "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "ContentPackageBuildLog",
    summary: `built=${built} failed=${failed}`,
    details: { built, failed },
  };
}

async function builderCard(): Promise<HealthCard> {
  const result = await safeRun(async () =>
    prisma.contentPackageBuildLog.groupBy({
      by: ["builderName"],
      _count: { _all: true },
    }),
  );
  if (!result.ok) {
    return errorCard({
      id: "builder",
      label: "Builder health",
      dataSource: "ContentPackageBuildLog",
      error: result.error,
    });
  }
  return {
    id: "builder",
    label: "Builder health",
    severity: "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "ContentPackageBuildLog",
    summary: `${result.value.length} builders observed`,
    details: { builderCount: result.value.length },
  };
}

async function strictQaCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const deleted = await prisma.rejectedContentLog.count({});
    const since24h = await prisma.rejectedContentLog.count({
      where: { deletedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return { deleted, since24h };
  });
  if (!result.ok) {
    return errorCard({
      id: "strict_qa",
      label: "Strict QA health",
      dataSource: "RejectedContentLog",
      error: result.error,
    });
  }
  return {
    id: "strict_qa",
    label: "Strict QA health",
    severity: result.value.since24h > 100 ? "warn" : "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "RejectedContentLog",
    summary: `deleted total=${result.value.deleted} (24h=${result.value.since24h})`,
    details: result.value,
  };
}

async function persistenceCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const where = { publicRenderReady: true, isThresholdEligible: true };
    const [pr, sa, ap, pa, dv, le, gl] = await Promise.all([
      prisma.prayer.count({ where }),
      prisma.saint.count({ where }),
      prisma.marianApparition.count({ where }),
      prisma.parish.count({ where }),
      prisma.devotion.count({ where }),
      prisma.liturgyEntry.count({ where }),
      prisma.spiritualLifeGuide.count({ where }),
    ]);
    return { pr, sa, ap, pa, dv, le, gl, total: pr + sa + ap + pa + dv + le + gl };
  });
  if (!result.ok) {
    return errorCard({
      id: "persistence",
      label: "Persistence health",
      dataSource: "Catalog tables (strict gate)",
      error: result.error,
    });
  }
  return {
    id: "persistence",
    label: "Persistence health",
    severity: "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "Catalog tables (strict gate)",
    summary: `${result.value.total} strict-public rows across the catalog`,
    details: result.value,
  };
}

async function cleanupCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const since24h = await prisma.rejectedContentLog.count({
      where: { deletedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return { since24h };
  });
  if (!result.ok) {
    return errorCard({
      id: "cleanup",
      label: "Cleanup health",
      dataSource: "RejectedContentLog",
      error: result.error,
    });
  }
  return {
    id: "cleanup",
    label: "Cleanup health",
    severity: "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "RejectedContentLog",
    summary: `${result.value.since24h} invalid rows deleted in last 24h`,
    details: result.value,
  };
}

async function growthCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newBuilds = await prisma.contentPackageBuildLog.count({
      where: {
        createdAt: { gte: since24h },
        buildStatus: "built_complete_package",
      },
    });
    return { newBuilds };
  });
  if (!result.ok) {
    return errorCard({
      id: "growth",
      label: "Growth health",
      dataSource: "ContentPackageBuildLog (24h window)",
      error: result.error,
    });
  }
  return {
    id: "growth",
    label: "Growth health",
    severity: result.value.newBuilds === 0 ? "warn" : "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "ContentPackageBuildLog (24h window)",
    summary: `${result.value.newBuilds} complete packages built in the last 24h`,
    details: result.value,
  };
}

async function securityCard(): Promise<HealthCard> {
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const breaches = await prisma.securityEvent.count({
      where: { classification: "Breach", createdAt: { gte: since24h } },
    });
    const suspicious = await prisma.securityEvent.count({
      where: { classification: "Suspicious", createdAt: { gte: since24h } },
    });
    const banned = await prisma.bannedDevice.count({ where: { active: true } });
    return { breaches, suspicious, banned };
  });
  if (!result.ok) {
    return errorCard({
      id: "security",
      label: "Security health",
      dataSource: "SecurityEvent + BannedDevice",
      error: result.error,
    });
  }
  return {
    id: "security",
    label: "Security health",
    severity: result.value.breaches > 0 ? "warn" : "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "SecurityEvent + BannedDevice",
    summary: `24h Breach=${result.value.breaches} Suspicious=${result.value.suspicious} banned=${result.value.banned}`,
    details: result.value,
  };
}

async function adminEmailCard(): Promise<HealthCard> {
  const configured =
    typeof process.env.ADMIN_EMAIL === "string" && process.env.ADMIN_EMAIL.length > 0;
  const resendKey =
    typeof process.env.RESEND_API_KEY === "string" && process.env.RESEND_API_KEY.length > 0;
  return {
    id: "admin_email",
    label: "Admin email health",
    severity: configured && resendKey ? "pass" : "warn",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "process.env (ADMIN_EMAIL, RESEND_API_KEY)",
    summary:
      configured && resendKey
        ? "ADMIN_EMAIL set and Resend configured"
        : `ADMIN_EMAIL=${configured ? "set" : "unset"} Resend=${resendKey ? "set" : "unset"}`,
    details: { adminEmailConfigured: configured, resendConfigured: resendKey },
  };
}

async function databaseCard(): Promise<HealthCard> {
  const result = await safeRun(async () => prisma.$queryRaw<unknown[]>`SELECT 1 as ok`);
  if (!result.ok) {
    return errorCard({
      id: "database",
      label: "Database health",
      dataSource: "Postgres",
      error: result.error,
    });
  }
  return {
    id: "database",
    label: "Database health",
    severity: "pass",
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "Postgres",
    summary: "Database responsive",
    details: {},
  };
}

// ─── Public API ─────────────────────────────────────────────────────

const COLLECTORS: Array<() => Promise<HealthCard>> = [
  queueCard,
  workerCard,
  sourceDiscoveryCard,
  sourceFetchCard,
  sourceDocumentCard,
  contentFactoryCard,
  builderCard,
  strictQaCard,
  persistenceCard,
  cleanupCard,
  growthCard,
  securityCard,
  adminEmailCard,
  databaseCard,
];

/** Run every diagnostic in parallel and aggregate. */
export async function loadSystemHealth(): Promise<SystemHealthReport> {
  const ranAt = new Date().toISOString();
  const cards = await Promise.all(
    COLLECTORS.map((fn) =>
      fn().catch(
        (e): HealthCard => ({
          id: "database",
          label: "Unknown collector",
          severity: "error",
          lastUpdatedAt: ranAt,
          dataSource: "unknown",
          summary: "Collector threw",
          details: {},
          errorMessage: e instanceof Error ? e.message : String(e),
        }),
      ),
    ),
  );
  const overall = worst(cards.map((c) => c.severity));
  logger.info("admin.system_health.run", {
    overallSeverity: overall,
    cardCount: cards.length,
  });
  return { overallSeverity: overall, ranAt, cards };
}

export const SYSTEM_HEALTH_CARD_IDS: ReadonlyArray<HealthCardId> = [
  "queue",
  "worker",
  "source_discovery",
  "source_fetch",
  "source_document",
  "content_factory",
  "builder",
  "strict_qa",
  "persistence",
  "cleanup",
  "growth",
  "security",
  "admin_email",
  "database",
];
