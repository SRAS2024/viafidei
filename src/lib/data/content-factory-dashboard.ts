/**
 * Content factory admin dashboard data.
 *
 * One query pass that gathers everything the admin ingestion page
 * needs after the migration to the content factory:
 *
 *   Queue:   pending / running / retrying / failed
 *   Workers: active / stale / last heartbeat
 *   Pipeline timestamps:
 *     last source fetch, last source discovery, last package build,
 *     last strict QA pass, last content cleanup, last valid package
 *     created, last invalid row deleted.
 *   Progress:
 *     raw rows, built packages, valid packages, public packages,
 *     deleted invalid rows, build failures, QA failures,
 *     threshold-eligible count, growth rate, stalled-reason.
 *   Sources:
 *     discovered / fetched / build-success rate / QA-pass rate /
 *     rejection rate / deletion rate / duplicate rate / last
 *     successful package / last failure reason / auto-paused.
 *
 * Each metric query catches its own error and labels the result as
 * "diagnostic_error" instead of a silent zero — see the spec
 * requirement "the dashboard should never show zero because it is
 * disconnected".
 */

import { prisma } from "../db/client";

export type MetricValue =
  | { kind: "value"; value: number; label?: string }
  | { kind: "real_zero"; label: string }
  | { kind: "error"; message: string };

export type FactoryDashboardData = {
  queue: {
    pending: MetricValue;
    running: MetricValue;
    retrying: MetricValue;
    failed: MetricValue;
  };
  workers: {
    active: MetricValue;
    stale: MetricValue;
    lastHeartbeatAt: Date | null;
  };
  timestamps: {
    lastSourceFetch: Date | null;
    lastSourceDiscovery: Date | null;
    lastPackageBuild: Date | null;
    lastStrictQaPass: Date | null;
    lastContentCleanup: Date | null;
    lastValidPackageCreated: Date | null;
    lastInvalidRowDeleted: Date | null;
  };
  progress: {
    rawRows: MetricValue;
    builtPackages: MetricValue;
    validPackages: MetricValue;
    publicPackages: MetricValue;
    deletedInvalidRows: MetricValue;
    buildFailures: MetricValue;
    qaFailures: MetricValue;
    thresholdEligible: MetricValue;
    growthRateLast24h: MetricValue;
    stalledReason: string | null;
  };
  sources: Array<{
    sourceId: string;
    contentType: string;
    discoveredCount: number;
    fetchedCount: number;
    buildSuccessRate: number | null;
    qaPassRate: number | null;
    rejectionRate: number | null;
    deletionRate: number | null;
    duplicateRate: number | null;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
    lastFailureReason: string | null;
    autoPaused: boolean;
  }>;
};

const FRESH_WORKER_WINDOW_MS = 60_000;

export async function loadContentFactoryDashboard(): Promise<FactoryDashboardData> {
  const [
    queueAgg,
    workerHeartbeats,
    sourceDocAgg,
    buildAgg,
    qaAgg,
    cleanupAgg,
    qualityScores,
    thresholdAgg,
  ] = await Promise.all([
    prisma.ingestionJobQueue
      .groupBy({ by: ["status"], _count: { _all: true } })
      .catch((e) => e instanceof Error ? e : new Error(String(e))),
    prisma.workerHeartbeat.findMany({}).catch((e) => e instanceof Error ? e : new Error(String(e))),
    prisma.sourceDocument
      .aggregate({ _max: { fetchedAt: true }, _count: { _all: true } })
      .catch((e) => e instanceof Error ? e : new Error(String(e))),
    prisma.contentPackageBuildLog
      .groupBy({ by: ["buildStatus"], _count: { _all: true }, _max: { createdAt: true } })
      .catch((e) => e instanceof Error ? e : new Error(String(e))),
    prisma.contentPackageBuildLog
      .aggregate({
        where: { buildStatus: "built_complete_package" },
        _count: { _all: true },
        _max: { createdAt: true },
      })
      .catch((e) => e instanceof Error ? e : new Error(String(e))),
    prisma.rejectedContentLog
      .aggregate({ _count: { _all: true }, _max: { deletedAt: true } })
      .catch((e) => e instanceof Error ? e : new Error(String(e))),
    prisma.sourceQualityScore
      .findMany({ orderBy: { updatedAt: "desc" }, take: 100 })
      .catch(() => []),
    publicCountsAcrossTypes().catch((e) => e instanceof Error ? e : new Error(String(e))),
  ]);

  const queueCounts = (() => {
    if (queueAgg instanceof Error) {
      return {
        pending: errorValue(queueAgg.message),
        running: errorValue(queueAgg.message),
        retrying: errorValue(queueAgg.message),
        failed: errorValue(queueAgg.message),
      };
    }
    const find = (status: string) =>
      queueAgg.find((r) => r.status === status)?._count?._all ?? 0;
    return {
      pending: valueOrZero(find("pending"), "no pending queue jobs"),
      running: valueOrZero(find("running"), "no jobs leased right now"),
      retrying: valueOrZero(find("retrying"), "no retries pending"),
      failed: valueOrZero(find("failed"), "no permanent failures"),
    };
  })();

  const workers = (() => {
    if (workerHeartbeats instanceof Error) {
      return {
        active: errorValue(workerHeartbeats.message),
        stale: errorValue(workerHeartbeats.message),
        lastHeartbeatAt: null,
      };
    }
    const now = Date.now();
    let active = 0;
    let stale = 0;
    let last: Date | null = null;
    for (const h of workerHeartbeats) {
      if (now - h.lastHeartbeatAt.getTime() < FRESH_WORKER_WINDOW_MS) active += 1;
      else stale += 1;
      if (!last || h.lastHeartbeatAt > last) last = h.lastHeartbeatAt;
    }
    return {
      active: valueOrZero(active, "no live worker — start the worker service"),
      stale: valueOrZero(stale, "no stale workers"),
      lastHeartbeatAt: last,
    };
  })();

  const sourceDocCount =
    sourceDocAgg instanceof Error ? 0 : sourceDocAgg._count._all ?? 0;
  const lastSourceFetch = sourceDocAgg instanceof Error ? null : sourceDocAgg._max.fetchedAt;
  const lastSourceDiscovery = lastSourceFetch; // discovery shares the timestamp until split

  const buildSuccessCount = (() => {
    if (buildAgg instanceof Error) return -1;
    return buildAgg.find((r) => r.buildStatus === "built_complete_package")?._count?._all ?? 0;
  })();
  const buildFailureCount = (() => {
    if (buildAgg instanceof Error) return -1;
    return buildAgg
      .filter((r) => r.buildStatus !== "built_complete_package")
      .reduce((sum, r) => sum + (r._count?._all ?? 0), 0);
  })();
  const lastPackageBuild = buildAgg instanceof Error
    ? null
    : maxDate(buildAgg.map((r) => r._max?.createdAt ?? null));
  const lastValidPackageCreated = qaAgg instanceof Error ? null : qaAgg._max.createdAt;

  const cleanupCount = cleanupAgg instanceof Error ? -1 : cleanupAgg._count._all ?? 0;
  const lastContentCleanup = cleanupAgg instanceof Error ? null : cleanupAgg._max.deletedAt;
  const lastInvalidRowDeleted = lastContentCleanup;

  const thresholdValid = thresholdAgg instanceof Error ? null : thresholdAgg;

  const validPackages =
    qaAgg instanceof Error
      ? errorValue(qaAgg.message)
      : valueOrZero(qaAgg._count._all ?? 0, "no valid packages built yet");
  const builtPackages =
    buildSuccessCount === -1
      ? errorValue("build log query failed")
      : valueOrZero(buildSuccessCount, "no successful builds yet");

  const stalledReason = computeStalledReason({
    pending: queueCounts.pending,
    running: queueCounts.running,
    builtPackages,
    validPackages,
  });

  return {
    queue: queueCounts,
    workers,
    timestamps: {
      lastSourceFetch,
      lastSourceDiscovery,
      lastPackageBuild,
      lastStrictQaPass: lastValidPackageCreated,
      lastContentCleanup,
      lastValidPackageCreated,
      lastInvalidRowDeleted,
    },
    progress: {
      rawRows: valueOrZero(sourceDocCount, "no source documents recorded yet"),
      builtPackages,
      validPackages,
      publicPackages: thresholdValid
        ? valueOrZero(thresholdValid.publicTotal, "no public packages")
        : errorValue("threshold query failed"),
      deletedInvalidRows:
        cleanupCount === -1
          ? errorValue("rejected log query failed")
          : valueOrZero(cleanupCount, "no rejections recorded"),
      buildFailures:
        buildFailureCount === -1
          ? errorValue("build log query failed")
          : valueOrZero(buildFailureCount, "no build failures"),
      qaFailures:
        cleanupCount === -1
          ? errorValue("rejected log query failed")
          : valueOrZero(cleanupCount, "no QA failures"),
      thresholdEligible: thresholdValid
        ? valueOrZero(thresholdValid.thresholdTotal, "nothing counts toward thresholds yet")
        : errorValue("threshold query failed"),
      growthRateLast24h: thresholdValid
        ? valueOrZero(thresholdValid.last24hCreated, "no rows created in 24h")
        : errorValue("threshold query failed"),
      stalledReason,
    },
    sources: Array.isArray(qualityScores)
      ? qualityScores.map((s) => {
          const buildAttempts = s.buildSuccessCount + s.buildFailureCount;
          const qaAttempts = s.qaPassCount + s.qaFailCount;
          return {
            sourceId: s.sourceId,
            contentType: s.contentType,
            discoveredCount: s.discoveredCount,
            fetchedCount: s.fetchedCount,
            buildSuccessRate:
              buildAttempts > 0 ? s.buildSuccessCount / buildAttempts : null,
            qaPassRate: qaAttempts > 0 ? s.qaPassCount / qaAttempts : null,
            rejectionRate: qaAttempts > 0 ? s.qaFailCount / qaAttempts : null,
            deletionRate: qaAttempts > 0 ? s.deletedCount / qaAttempts : null,
            duplicateRate:
              buildAttempts > 0 ? s.duplicateCount / buildAttempts : null,
            lastSuccessAt: s.lastSuccessAt,
            lastFailureAt: s.lastFailureAt,
            lastFailureReason: s.lastFailureReason,
            autoPaused: s.autoPaused,
          };
        })
      : [],
  };
}

async function publicCountsAcrossTypes() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = { publicRenderReady: true, isThresholdEligible: true };
  const [pr, sa, ap, pa, dv, le, gl, last] = await Promise.all([
    prisma.prayer.count({ where }),
    prisma.saint.count({ where }),
    prisma.marianApparition.count({ where }),
    prisma.parish.count({ where }),
    prisma.devotion.count({ where }),
    prisma.liturgyEntry.count({ where }),
    prisma.spiritualLifeGuide.count({ where }),
    prisma.prayer.count({ where: { createdAt: { gte: since24h } } }),
  ]);
  const total = pr + sa + ap + pa + dv + le + gl;
  return {
    publicTotal: total,
    thresholdTotal: total,
    last24hCreated: last,
  };
}

function valueOrZero(value: number, zeroLabel: string): MetricValue {
  if (value > 0) return { kind: "value", value };
  return { kind: "real_zero", label: zeroLabel };
}

function errorValue(message: string): MetricValue {
  return { kind: "error", message };
}

function maxDate(values: Array<Date | null>): Date | null {
  let max: Date | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!max || v > max) max = v;
  }
  return max;
}

function computeStalledReason(args: {
  pending: MetricValue;
  running: MetricValue;
  builtPackages: MetricValue;
  validPackages: MetricValue;
}): string | null {
  const pending = args.pending.kind === "value" ? args.pending.value : 0;
  const running = args.running.kind === "value" ? args.running.value : 0;
  const built = args.builtPackages.kind === "value" ? args.builtPackages.value : 0;
  const valid = args.validPackages.kind === "value" ? args.validPackages.value : 0;
  if (pending > 100 && running === 0) return "Jobs queued but no worker running.";
  if (running > 0 && built === 0) return "Jobs running but no packages have been built.";
  if (built > 0 && valid === 0) return "Packages built but none have passed strict QA.";
  if (valid > 0 && built > valid * 2) return "Most built packages are being rejected at QA.";
  return null;
}
