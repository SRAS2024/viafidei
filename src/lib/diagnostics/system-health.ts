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
  | "database"
  | "fetch_to_build_chain";

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
  // Spec #10/#18: queue health must reflect ACTIVE failures, not the
  // lifetime total. A queue with 3000 historical failed rows that have
  // all been reviewed should be PASS — the system has resolved them.
  // Only recent failures, stuck-running jobs, and a long pending
  // backlog should trip the severity.
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stuckLeaseThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min
    const statusRows = await prisma.ingestionJobQueue.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      statusRows.map((r) => [r.status, r._count?._all ?? 0]),
    ) as Record<string, number>;
    const [failedLast24h, stuckRunning, oldestPending] = await Promise.all([
      prisma.ingestionJobQueue.count({
        where: { status: "failed", finishedAt: { gte: since24h } },
      }),
      prisma.ingestionJobQueue.count({
        where: {
          status: "running",
          OR: [
            { leaseExpiresAt: { lt: stuckLeaseThreshold } },
            { leaseExpiresAt: null, startedAt: { lt: stuckLeaseThreshold } },
          ],
        },
      }),
      prisma.ingestionJobQueue.findFirst({
        where: { status: "pending" },
        orderBy: { runAt: "asc" },
        select: { runAt: true },
      }),
    ]);
    return {
      counts,
      failedTotal: counts.failed ?? 0,
      failedLast24h,
      stuckRunning,
      oldestPending,
      pending: counts.pending ?? 0,
      running: counts.running ?? 0,
    };
  });
  if (!result.ok) {
    return errorCard({
      id: "queue",
      label: "Queue health",
      dataSource: "IngestionJobQueue",
      error: result.error,
    });
  }
  const oldestPendingMinutes = result.value.oldestPending
    ? Math.floor((Date.now() - result.value.oldestPending.runAt.getTime()) / 60000)
    : 0;
  // FAIL when a worker job is stuck running > 30min, or recent failures
  // are very high (a real production breakage). WARN for recoverable
  // failure spikes. PASS otherwise — historical failed rows do not
  // matter once they've stopped accumulating.
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (result.value.stuckRunning > 0) {
    severity = "fail";
    summary = `${result.value.stuckRunning} stuck-running jobs (>30min lease)`;
  } else if (result.value.failedLast24h > 200) {
    severity = "fail";
    summary = `${result.value.failedLast24h} jobs failed in last 24h (high)`;
  } else if (result.value.failedLast24h > 25) {
    severity = "warn";
    summary = `${result.value.failedLast24h} jobs failed in last 24h (recoverable)`;
  } else if (oldestPendingMinutes > 60 && result.value.pending > 100) {
    severity = "warn";
    summary = `${result.value.pending} pending jobs, oldest ${oldestPendingMinutes}m old`;
  } else {
    summary = `pending=${result.value.pending} running=${result.value.running} failedLast24h=${result.value.failedLast24h} failedTotal=${result.value.failedTotal}`;
  }
  return {
    id: "queue",
    label: "Queue health",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "IngestionJobQueue",
    summary,
    details: {
      pending: result.value.pending,
      running: result.value.running,
      failedTotal: result.value.failedTotal,
      failedLast24h: result.value.failedLast24h,
      stuckRunning: result.value.stuckRunning,
      oldestPendingMinutes,
      completed: result.value.counts.completed ?? 0,
      skipped: result.value.counts.skipped ?? 0,
      retrying: result.value.counts.retrying ?? 0,
    },
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
  // Spec #21: content factory health uses a 24h window so once-bad
  // history doesn't permanently warn. Terminal QA rejections (wrong-
  // content / router-rejected) are tracked separately from
  // infrastructure failures so the card distinguishes "factory is
  // correctly rejecting bad URLs" from "factory is broken".
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const builds = await prisma.contentPackageBuildLog.groupBy({
      by: ["buildStatus"],
      _count: { _all: true },
    });
    const buildsLast24h = await prisma.contentPackageBuildLog.groupBy({
      by: ["buildStatus"],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    });
    const totals = Object.fromEntries(
      builds.map((b) => [b.buildStatus, b._count?._all ?? 0]),
    ) as Record<string, number>;
    const last24h = Object.fromEntries(
      buildsLast24h.map((b) => [b.buildStatus, b._count?._all ?? 0]),
    ) as Record<string, number>;
    return { totals, last24h };
  });
  if (!result.ok) {
    return errorCard({
      id: "content_factory",
      label: "Content factory health",
      dataSource: "ContentPackageBuildLog",
      error: result.error,
    });
  }
  const built24h = result.value.last24h.built_complete_package ?? 0;
  // Terminal QA rejects: the builder correctly identified a wrong-
  // content / not-allowed candidate. These are GOOD outcomes — they
  // mean strict QA is working. Count separately from infrastructure
  // failures.
  const TERMINAL_REJECT_STATUSES = new Set([
    "wrong_content",
    "source_not_allowed",
    "duplicate",
    "not_supported_by_source",
    "source_exhausted",
  ]);
  let infraFailed24h = 0;
  let terminalRejected24h = 0;
  for (const [status, count] of Object.entries(result.value.last24h)) {
    if (status === "built_complete_package") continue;
    if (TERMINAL_REJECT_STATUSES.has(status)) {
      terminalRejected24h += count;
    } else {
      infraFailed24h += count;
    }
  }
  const attempted24h = built24h + infraFailed24h + terminalRejected24h;
  const builtTotal = result.value.totals.built_complete_package ?? 0;
  // FAIL when builds were attempted but nothing built. WARN when most
  // attempts produce only terminal rejections (the URL stream is
  // garbage). PASS when complete packages are being built.
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (attempted24h > 0 && built24h === 0) {
    severity = "fail";
    summary = `${attempted24h} builds attempted in 24h, ${built24h} complete (${infraFailed24h} infra-fail, ${terminalRejected24h} terminal-reject)`;
  } else if (attempted24h > 20 && built24h / attempted24h < 0.1) {
    severity = "warn";
    summary = `low build success rate: ${built24h}/${attempted24h} complete in 24h`;
  } else if (built24h === 0 && builtTotal === 0) {
    severity = "warn";
    summary = "no complete packages built ever — factory has not produced content yet";
  } else {
    summary = `built24h=${built24h} terminalReject24h=${terminalRejected24h} infraFail24h=${infraFailed24h} total=${builtTotal}`;
  }
  return {
    id: "content_factory",
    label: "Content factory health",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "ContentPackageBuildLog",
    summary,
    details: {
      builtLast24h: built24h,
      terminalRejectedLast24h: terminalRejected24h,
      infraFailedLast24h: infraFailed24h,
      attemptedLast24h: attempted24h,
      builtTotal,
    },
  };
}

async function builderCard(): Promise<HealthCard> {
  // Spec #12/#20: builder health must track which builders have
  // produced recent successful complete packages — not just whether
  // any builder name has been seen at all. A builder that has only
  // ever failed must surface as WARN, and the card only PASSes when
  // at least one enabled builder has a recent (24h) success.
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const observed = await prisma.contentPackageBuildLog.groupBy({
      by: ["builderName"],
      _count: { _all: true },
    });
    const successesLast24h = await prisma.contentPackageBuildLog.groupBy({
      by: ["builderName"],
      where: {
        createdAt: { gte: since24h },
        buildStatus: "built_complete_package",
      },
      _count: { _all: true },
    });
    const allSuccess = await prisma.contentPackageBuildLog.groupBy({
      by: ["builderName"],
      where: { buildStatus: "built_complete_package" },
      _count: { _all: true },
    });
    return {
      observed: observed.map((o) => o.builderName),
      successesLast24h: new Set(successesLast24h.map((o) => o.builderName)),
      allSuccess: new Set(allSuccess.map((o) => o.builderName)),
    };
  });
  if (!result.ok) {
    return errorCard({
      id: "builder",
      label: "Builder health",
      dataSource: "ContentPackageBuildLog",
      error: result.error,
    });
  }
  const observed = result.value.observed.length;
  const onlyFailures = result.value.observed.filter(
    (name) => !result.value.allSuccess.has(name),
  );
  const successesRecent = result.value.successesLast24h.size;
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (observed > 0 && successesRecent === 0 && onlyFailures.length > 0) {
    severity = "fail";
    summary = `${observed} builders observed but ${onlyFailures.length} only failing (no recent success)`;
  } else if (observed > 0 && successesRecent === 0) {
    severity = "warn";
    summary = `${observed} builders observed, but none produced a complete package in last 24h`;
  } else if (onlyFailures.length > 0) {
    severity = "warn";
    summary = `${successesRecent} builder(s) with recent success, ${onlyFailures.length} only failing`;
  } else {
    summary = `${observed} builders observed, ${successesRecent} produced complete packages in last 24h`;
  }
  return {
    id: "builder",
    label: "Builder health",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "ContentPackageBuildLog",
    summary,
    details: {
      buildersObserved: observed,
      buildersWithSuccessLast24h: successesRecent,
      buildersWithEverSuccess: result.value.allSuccess.size,
      buildersOnlyFailing: onlyFailures.length,
    },
  };
}

async function strictQaCard(): Promise<HealthCard> {
  // Spec #8/#16: strict QA health distinguishes CURRENT invalid public
  // rows from CLEANUP HISTORY. A 24h window catches recent rejections
  // (which may indicate a regression); historical legacy cleanup
  // counts are shown for context but do not by themselves cause WARN
  // once the cleanup has stabilized.
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      deletedTotal,
      deletedLast24h,
      deletedLast7d,
      currentInvalidPrayer,
      currentInvalidSaint,
      currentInvalidApparition,
      currentInvalidDevotion,
      currentInvalidGuide,
      currentInvalidLiturgy,
      currentInvalidParish,
    ] = await Promise.all([
      prisma.rejectedContentLog.count({}),
      prisma.rejectedContentLog.count({ where: { deletedAt: { gte: since24h } } }),
      prisma.rejectedContentLog.count({ where: { deletedAt: { gte: sevenDays } } }),
      prisma.prayer.count({
        where: {
          OR: [
            { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
            { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
          ],
        },
      }),
      prisma.saint.count({
        where: {
          OR: [
            { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
            { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
          ],
        },
      }),
      prisma.marianApparition.count({
        where: {
          OR: [
            { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
            { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
          ],
        },
      }),
      prisma.devotion.count({
        where: {
          OR: [
            { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
            { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
          ],
        },
      }),
      prisma.spiritualLifeGuide.count({
        where: {
          OR: [
            { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
            { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
          ],
        },
      }),
      prisma.liturgyEntry.count({
        where: {
          OR: [
            { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
            { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
          ],
        },
      }),
      prisma.parish.count({
        where: {
          OR: [
            { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
            { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
          ],
        },
      }),
    ]);
    const currentInvalid =
      currentInvalidPrayer +
      currentInvalidSaint +
      currentInvalidApparition +
      currentInvalidDevotion +
      currentInvalidGuide +
      currentInvalidLiturgy +
      currentInvalidParish;
    return {
      deletedTotal,
      deletedLast24h,
      deletedLast7d,
      currentInvalid,
    };
  });
  if (!result.ok) {
    return errorCard({
      id: "strict_qa",
      label: "Strict QA health",
      dataSource: "RejectedContentLog + Catalog tables",
      error: result.error,
    });
  }
  // FAIL when public rows are currently invalid — a row marked
  // publicRenderReady=true but flagged as invalid by strict QA is the
  // serious failure (users see broken content).
  // WARN when recent rejections are very high (regression watch).
  // PASS when cleanup has stabilized and no current invalid public rows.
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (result.value.currentInvalid > 0) {
    severity = "fail";
    summary = `${result.value.currentInvalid} CURRENT invalid public rows — strict gate breached`;
  } else if (result.value.deletedLast24h > 200) {
    severity = "warn";
    summary = `${result.value.deletedLast24h} rejections in last 24h (high — possible regression)`;
  } else {
    summary = `no current invalid public rows. deleted: 24h=${result.value.deletedLast24h} 7d=${result.value.deletedLast7d} total=${result.value.deletedTotal}`;
  }
  return {
    id: "strict_qa",
    label: "Strict QA health",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "RejectedContentLog + Catalog tables",
    summary,
    details: result.value,
  };
}

async function persistenceCard(): Promise<HealthCard> {
  // Spec #9/#17: persistence must be honest. A content factory that
  // has built ZERO strict-public rows is NOT a healthy factory — the
  // card cannot PASS just because the persistence layer is structurally
  // OK. The rules:
  //   FAIL  invalidPublicRows > 0
  //   FAIL  totalStrictPublicRows === 0 AND factoryAttemptedBuilds > 0
  //   WARN  totalStrictPublicRows === 0 (factory hasn't run yet)
  //   PASS  totalStrictPublicRows > 0 AND no invalid rows
  const result = await safeRun(async () => {
    const validWhere = { publicRenderReady: true, isThresholdEligible: true };
    const invalidWhere = {
      OR: [
        { publicRenderReady: true, packageValidationStatus: { not: "valid" } },
        { isThresholdEligible: true, packageValidationStatus: { not: "valid" } },
      ],
    };
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pr, sa, ap, pa, dv, le, gl] = await Promise.all([
      prisma.prayer.count({ where: validWhere }),
      prisma.saint.count({ where: validWhere }),
      prisma.marianApparition.count({ where: validWhere }),
      prisma.parish.count({ where: validWhere }),
      prisma.devotion.count({ where: validWhere }),
      prisma.liturgyEntry.count({ where: validWhere }),
      prisma.spiritualLifeGuide.count({ where: validWhere }),
    ]);
    const [iv1, iv2, iv3, iv4, iv5, iv6, iv7] = await Promise.all([
      prisma.prayer.count({ where: invalidWhere }),
      prisma.saint.count({ where: invalidWhere }),
      prisma.marianApparition.count({ where: invalidWhere }),
      prisma.parish.count({ where: invalidWhere }),
      prisma.devotion.count({ where: invalidWhere }),
      prisma.liturgyEntry.count({ where: invalidWhere }),
      prisma.spiritualLifeGuide.count({ where: invalidWhere }),
    ]);
    const factoryAttempted24h = await prisma.contentPackageBuildLog.count({
      where: { createdAt: { gte: since24h } },
    });
    const persistedLast24h = await prisma.contentPackageBuildLog.count({
      where: { createdAt: { gte: since24h }, buildStatus: "built_complete_package" },
    });
    return {
      pr,
      sa,
      ap,
      pa,
      dv,
      le,
      gl,
      total: pr + sa + ap + pa + dv + le + gl,
      invalid: iv1 + iv2 + iv3 + iv4 + iv5 + iv6 + iv7,
      factoryAttempted24h,
      persistedLast24h,
    };
  });
  if (!result.ok) {
    return errorCard({
      id: "persistence",
      label: "Persistence health",
      dataSource: "Catalog tables (strict gate)",
      error: result.error,
    });
  }
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (result.value.invalid > 0) {
    severity = "fail";
    summary = `${result.value.invalid} strict-public rows fail validation — catalog has invalid content`;
  } else if (result.value.total === 0 && result.value.factoryAttempted24h > 0) {
    severity = "fail";
    summary = `0 strict-public rows but factory attempted ${result.value.factoryAttempted24h} builds in 24h — factory is producing nothing`;
  } else if (result.value.total === 0) {
    severity = "warn";
    summary = "0 strict-public rows across the catalog — factory has not produced content yet";
  } else {
    summary = `${result.value.total} strict-public rows across the catalog (${result.value.persistedLast24h} persisted in last 24h)`;
  }
  return {
    id: "persistence",
    label: "Persistence health",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "Catalog tables (strict gate)",
    summary,
    details: result.value,
  };
}

async function cleanupCard(): Promise<HealthCard> {
  // Spec #16: cleanup health distinguishes legacy cleanup history from
  // active production breakage. A factory that just deleted 900 bad
  // legacy rows is HEALTHY (the cleanup worked); a factory deleting
  // 900 fresh factory outputs is BROKEN. We compare the deletion rate
  // against the build rate to tell the two apart.
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [deletedLast24h, deletedLast7d, builtLast24h] = await Promise.all([
      prisma.rejectedContentLog.count({ where: { deletedAt: { gte: since24h } } }),
      prisma.rejectedContentLog.count({ where: { deletedAt: { gte: sevenDays } } }),
      prisma.contentPackageBuildLog.count({
        where: {
          createdAt: { gte: since24h },
          buildStatus: "built_complete_package",
        },
      }),
    ]);
    return { deletedLast24h, deletedLast7d, builtLast24h };
  });
  if (!result.ok) {
    return errorCard({
      id: "cleanup",
      label: "Cleanup health",
      dataSource: "RejectedContentLog",
      error: result.error,
    });
  }
  // PASS by default — cleanup is a maintenance operation, not an
  // error. WARN when deletion outpaces build (the factory is producing
  // garbage faster than valid content) AND there's a meaningful sample
  // size.
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (
    result.value.deletedLast24h > 25 &&
    result.value.deletedLast24h > result.value.builtLast24h * 3
  ) {
    severity = "warn";
    summary = `${result.value.deletedLast24h} deleted vs ${result.value.builtLast24h} built in 24h — factory output is mostly bad`;
  } else {
    summary = `${result.value.deletedLast24h} invalid rows deleted in last 24h (${result.value.deletedLast7d} in last 7d, normal cleanup)`;
  }
  return {
    id: "cleanup",
    label: "Cleanup health",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "RejectedContentLog",
    summary,
    details: result.value,
  };
}

async function growthCard(): Promise<HealthCard> {
  // Spec #22: growth must pass only when content actually reached the
  // public catalog. Building packages is not enough — the catalog must
  // grow (or refresh) for a PASS.
  //   FAIL  build attempts happened but no package persisted
  //   WARN  no new public rows in the growth window
  //   PASS  public catalog grew or refreshed successfully
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const attemptedLast24h = await prisma.contentPackageBuildLog.count({
      where: { createdAt: { gte: since24h } },
    });
    const completeLast24h = await prisma.contentPackageBuildLog.count({
      where: {
        createdAt: { gte: since24h },
        buildStatus: "built_complete_package",
      },
    });
    // Public rows created or updated in the growth window. Both new
    // rows and content updates count as "growth" because the catalog
    // is fresher after each.
    const where = { lastPackageValidatedAt: { gte: since24h } };
    const [pr, sa, ap, pa, dv, le, gl] = await Promise.all([
      prisma.prayer.count({ where }),
      prisma.saint.count({ where }),
      prisma.marianApparition.count({ where }),
      prisma.parish.count({ where }),
      prisma.devotion.count({ where }),
      prisma.liturgyEntry.count({ where }),
      prisma.spiritualLifeGuide.count({ where }),
    ]);
    const publicRowsTouched = pr + sa + ap + pa + dv + le + gl;
    return { attemptedLast24h, completeLast24h, publicRowsTouched };
  });
  if (!result.ok) {
    return errorCard({
      id: "growth",
      label: "Growth health",
      dataSource: "ContentPackageBuildLog + Catalog tables (24h window)",
      error: result.error,
    });
  }
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (result.value.attemptedLast24h > 0 && result.value.completeLast24h === 0) {
    severity = "fail";
    summary = `${result.value.attemptedLast24h} build attempts in 24h, 0 complete packages — factory not producing content`;
  } else if (result.value.publicRowsTouched === 0) {
    severity = "warn";
    summary = `${result.value.completeLast24h} complete packages built but 0 public rows created/updated in last 24h`;
  } else {
    summary = `${result.value.publicRowsTouched} public catalog rows created/updated in last 24h (${result.value.completeLast24h} complete packages built)`;
  }
  return {
    id: "growth",
    label: "Growth health",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "ContentPackageBuildLog + Catalog tables (24h window)",
    summary,
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

async function fetchToBuildChainCard(): Promise<HealthCard> {
  // Spec #11/#19: the most useful single diagnostic — when source
  // fetches complete but no content_build jobs are enqueued, the
  // factory is silently producing nothing. Without this card the
  // queue/worker/factory cards all look healthy while the chain is
  // broken between fetch and build.
  //
  // The card reads from QueueAuditLog chain.* events written by the
  // dispatchers. `chain.source_document_created` counts completed
  // fetches; `chain.source_fetch_to_build` carries the enqueued-build
  // count metadata. We sum the enqueued counts to compare against
  // the fetch count.
  const result = await safeRun(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fetches = await prisma.queueAuditLog.findMany({
      where: { event: "chain.source_document_created", createdAt: { gte: since24h } },
      select: { id: true },
      take: 5000,
    });
    const fetchToBuild = await prisma.queueAuditLog.findMany({
      where: { event: "chain.source_fetch_to_build", createdAt: { gte: since24h } },
      select: { metadata: true },
      take: 5000,
    });
    let totalEnqueued = 0;
    let zeroBuildEvents = 0;
    for (const row of fetchToBuild) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const enqueued =
        typeof meta.enqueuedCount === "number" ? (meta.enqueuedCount as number) : 0;
      totalEnqueued += enqueued;
      if (enqueued === 0) zeroBuildEvents += 1;
    }
    return {
      fetchesCompletedLast24h: fetches.length,
      fetchToBuildEventsLast24h: fetchToBuild.length,
      contentBuildsEnqueuedLast24h: totalEnqueued,
      fetchesWithZeroBuildsLast24h: zeroBuildEvents,
    };
  });
  if (!result.ok) {
    return errorCard({
      id: "fetch_to_build_chain",
      label: "Source fetch to build chain",
      dataSource: "QueueAuditLog (chain.* events, 24h window)",
      error: result.error,
    });
  }
  const fetches = result.value.fetchesCompletedLast24h;
  const builds = result.value.contentBuildsEnqueuedLast24h;
  const zeroBuilds = result.value.fetchesWithZeroBuildsLast24h;
  const zeroBuildRate =
    result.value.fetchToBuildEventsLast24h > 0
      ? zeroBuilds / result.value.fetchToBuildEventsLast24h
      : 0;
  let severity: HealthSeverity = "pass";
  let summary: string;
  if (fetches > 0 && builds === 0) {
    severity = "fail";
    summary = `${fetches} fetches completed in 24h, 0 content_build jobs enqueued — chain is BROKEN between fetch and build`;
  } else if (zeroBuildRate > 0.5) {
    severity = "warn";
    summary = `${(zeroBuildRate * 100).toFixed(0)}% of fetches enqueued zero builds (${zeroBuilds}/${result.value.fetchToBuildEventsLast24h})`;
  } else if (fetches === 0) {
    severity = "warn";
    summary = "no fetches completed in last 24h — pipeline upstream is idle";
  } else {
    summary = `${fetches} fetches → ${builds} content_build jobs enqueued in last 24h`;
  }
  return {
    id: "fetch_to_build_chain",
    label: "Source fetch to build chain",
    severity,
    lastUpdatedAt: new Date().toISOString(),
    dataSource: "QueueAuditLog (chain.* events, 24h window)",
    summary,
    details: result.value,
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
  fetchToBuildChainCard,
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
  "fetch_to_build_chain",
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
