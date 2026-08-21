/**
 * The Admin Worker's ears (spec §14 "Ears", §16 "adaptive acquisition").
 *
 * Noticing *change* is cheaper than re-reading the world. The worker already
 * stores everything needed to do this well and was throwing most of it away:
 *
 *   - `AdminWorkerSourceRead`  keeps a sha256 checksum, ETag and Last-Modified
 *                              header per source URL,
 *   - `AdminWorkerFetchResult` keeps the last successful fetch + checksum,
 *   - `AdminWorkerMemory`      is a durable key/value store.
 *
 * This module turns those into a change sense:
 *
 *   `senseUrl`            → should we re-read this page at all, and with which
 *                           conditional headers (If-None-Match / If-Modified-Since)?
 *   `recordObservation`   → learn each host's real change cadence, so a page
 *                           that changes yearly is not polled hourly.
 *   `rankStaleSources`    → which known sources are most likely to have changed
 *                           right now (freshness schedule).
 *   `senseFeedChange`     → has an RSS/Atom feed or sitemap moved on since the
 *                           last time we looked?
 *
 * Nothing here fetches on its own — callers pass the bytes they already have.
 * That keeps the "cheapest reader first" rule honest.
 */

import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

const MEMORY_TYPE = "GENERIC" as const;
const CADENCE_PREFIX = "change.cadence.";

/** Default minimum re-read interval when nothing is known about a host. */
export const DEFAULT_MIN_REREAD_MS = 6 * 60 * 60 * 1000; // 6h
/** Never wait longer than this before revalidating a known source. */
export const MAX_REREAD_MS = 30 * 24 * 60 * 60 * 1000; // 30d

export interface ConditionalHeaders {
  "If-None-Match"?: string;
  "If-Modified-Since"?: string;
}

export interface UrlChangeSense {
  url: string;
  host: string;
  /** True when the worker should spend a request on this URL now. */
  shouldRead: boolean;
  reason: string;
  /** Conditional-request headers that let the server answer 304 cheaply. */
  conditionalHeaders: ConditionalHeaders;
  /** Checksum of the last body we stored, if any. */
  knownChecksum: string | null;
  lastReadAt: Date | null;
  ageMs: number | null;
  /** Learned re-read interval for this host. */
  rereadIntervalMs: number;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

export function checksumOfBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/* ------------------------------------------------------------------ */
/* learned cadence                                                     */
/* ------------------------------------------------------------------ */

interface CadenceMemory {
  /** Observations where the body had changed since the previous read. */
  changed: number;
  /** Observations where the body was byte-identical. */
  unchanged: number;
  /** Mean observed gap between two *changed* reads (ms). */
  meanChangeGapMs: number | null;
  lastChangedAt: string | null;
  updatedAt: string;
}

async function readCadence(prisma: PrismaClient, host: string): Promise<CadenceMemory | null> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: {
        memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: `${CADENCE_PREFIX}${host}` },
      },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = row?.memoryValue;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const rec = v as Record<string, unknown>;
  return {
    changed: typeof rec.changed === "number" ? rec.changed : 0,
    unchanged: typeof rec.unchanged === "number" ? rec.unchanged : 0,
    meanChangeGapMs: typeof rec.meanChangeGapMs === "number" ? rec.meanChangeGapMs : null,
    lastChangedAt: typeof rec.lastChangedAt === "string" ? rec.lastChangedAt : null,
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date(0).toISOString(),
  };
}

/**
 * Re-read interval derived from what the host has actually done. A host that
 * always answers "unchanged" earns a longer interval; one that changes on most
 * reads earns a short one. Bounded so we neither hammer nor forget a source.
 */
export function rereadIntervalFor(cadence: CadenceMemory | null): number {
  if (!cadence) return DEFAULT_MIN_REREAD_MS;
  const total = cadence.changed + cadence.unchanged;
  if (total < 3) return DEFAULT_MIN_REREAD_MS;
  if (cadence.meanChangeGapMs && cadence.meanChangeGapMs > 0) {
    // Aim to look at roughly half the observed change period.
    return Math.min(MAX_REREAD_MS, Math.max(30 * 60_000, cadence.meanChangeGapMs / 2));
  }
  const changeRate = cadence.changed / total;
  if (changeRate >= 0.5) return 60 * 60 * 1000; // busy source — hourly
  if (changeRate >= 0.2) return 12 * 60 * 60 * 1000;
  if (changeRate >= 0.05) return 3 * 24 * 60 * 60 * 1000;
  return 14 * 24 * 60 * 60 * 1000; // effectively static
}

/**
 * Record what a read actually revealed. `changed` should be true when the body
 * checksum differed from the stored one (or the source was new).
 */
export async function recordObservation(
  prisma: PrismaClient,
  input: { url: string; changed: boolean; observedAt?: Date },
): Promise<void> {
  const host = hostOf(input.url);
  if (!host) return;
  const now = input.observedAt ?? new Date();
  const prior = await readCadence(prisma, host);

  let meanChangeGapMs = prior?.meanChangeGapMs ?? null;
  if (input.changed && prior?.lastChangedAt) {
    const gap = now.getTime() - Date.parse(prior.lastChangedAt);
    if (Number.isFinite(gap) && gap > 0) {
      meanChangeGapMs = meanChangeGapMs === null ? gap : meanChangeGapMs * 0.7 + gap * 0.3;
    }
  }

  const next: CadenceMemory = {
    changed: (prior?.changed ?? 0) + (input.changed ? 1 : 0),
    unchanged: (prior?.unchanged ?? 0) + (input.changed ? 0 : 1),
    meanChangeGapMs,
    lastChangedAt: input.changed ? now.toISOString() : (prior?.lastChangedAt ?? null),
    updatedAt: now.toISOString(),
  };

  await prisma.adminWorkerMemory
    .upsert({
      where: {
        memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: `${CADENCE_PREFIX}${host}` },
      },
      create: {
        memoryType: MEMORY_TYPE,
        memoryKey: `${CADENCE_PREFIX}${host}`,
        memoryValue: next as never,
        confidence: 0.6,
        successCount: next.changed,
        failureCount: 0,
        lastUsedAt: now,
      },
      update: {
        memoryValue: next as never,
        successCount: next.changed,
        lastUsedAt: now,
      },
    })
    .catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* per-URL sense                                                       */
/* ------------------------------------------------------------------ */

/**
 * Decide whether a URL is worth spending a request on, and hand back the
 * conditional headers that let the origin answer 304 for free.
 */
export async function senseUrl(
  prisma: PrismaClient,
  url: string,
  opts: { force?: boolean } = {},
): Promise<UrlChangeSense> {
  const host = hostOf(url);
  const [read, lastAttempt, cadence] = await Promise.all([
    prisma.adminWorkerSourceRead
      .findFirst({
        where: { sourceUrl: url },
        orderBy: { createdAt: "desc" },
        select: {
          checksum: true,
          etag: true,
          lastModifiedHeader: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => null),
    // The last time this URL was actually CHECKED, which for an unchanged page
    // is a 304 recorded as a fetch result rather than a new source-read row.
    prisma.adminWorkerFetchResult
      .findFirst({
        where: { sourceUrl: url, succeeded: true },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
      .catch(() => null),
    readCadence(prisma, host),
  ]);

  const rereadIntervalMs = rereadIntervalFor(cadence);
  // Freshness is "when did we last confirm this page", so take the most recent
  // of: the stored body, the row's last refresh, and the last successful fetch.
  // Using only the body's createdAt would leave an unchanged page permanently
  // overdue — it would be re-fetched on every pass forever.
  const checkedAtCandidates = [read?.createdAt, read?.updatedAt, lastAttempt?.createdAt].filter(
    (d): d is Date => d instanceof Date,
  );
  const lastReadAt = checkedAtCandidates.length
    ? new Date(Math.max(...checkedAtCandidates.map((d) => d.getTime())))
    : null;
  const ageMs = lastReadAt ? Date.now() - lastReadAt.getTime() : null;

  const conditionalHeaders: ConditionalHeaders = {};
  if (read?.etag) conditionalHeaders["If-None-Match"] = read.etag;
  if (read?.lastModifiedHeader) conditionalHeaders["If-Modified-Since"] = read.lastModifiedHeader;

  let shouldRead = true;
  let reason = "never read before — first read.";
  if (opts.force) {
    reason = "forced read requested by the operator.";
  } else if (ageMs !== null) {
    if (ageMs < rereadIntervalMs) {
      shouldRead = false;
      reason =
        `read ${Math.round(ageMs / 60_000)} min ago; this host's learned change interval is ` +
        `${Math.round(rereadIntervalMs / 60_000)} min — reusing the durable source read.`;
    } else {
      reason =
        `last read ${Math.round(ageMs / 3_600_000)}h ago (interval ` +
        `${Math.round(rereadIntervalMs / 3_600_000)}h) — revalidating conditionally.`;
    }
  }

  return {
    url,
    host,
    shouldRead,
    reason,
    conditionalHeaders,
    knownChecksum: read?.checksum ?? null,
    lastReadAt,
    ageMs,
    rereadIntervalMs,
  };
}

/* ------------------------------------------------------------------ */
/* feeds, sitemaps, and the freshness schedule                          */
/* ------------------------------------------------------------------ */

export interface FeedChange {
  /** URLs present in the feed/sitemap that the worker has never read. */
  newUrls: string[];
  /** URLs already read whose stored copy is now older than the interval. */
  refreshUrls: string[];
  /** URLs skipped because nothing suggests they changed. */
  unchangedCount: number;
}

/**
 * Compare a set of URLs advertised by a feed, sitemap, or index page against
 * what the worker has already read, so only genuinely new or genuinely stale
 * material is queued (spec §14 "Ears" 1-3, §16).
 */
export async function senseFeedChange(
  prisma: PrismaClient,
  urls: string[],
  opts: { limit?: number } = {},
): Promise<FeedChange> {
  const unique = Array.from(new Set(urls.filter(Boolean))).slice(0, opts.limit ?? 500);
  if (unique.length === 0) return { newUrls: [], refreshUrls: [], unchangedCount: 0 };

  const known = await prisma.adminWorkerSourceRead
    .findMany({
      where: { sourceUrl: { in: unique } },
      select: { sourceUrl: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => [] as Array<{ sourceUrl: string; createdAt: Date }>);

  const latest = new Map<string, Date>();
  for (const row of known) {
    if (!latest.has(row.sourceUrl)) latest.set(row.sourceUrl, row.createdAt);
  }

  const newUrls: string[] = [];
  const refreshUrls: string[] = [];
  let unchangedCount = 0;

  const cadenceCache = new Map<string, number>();
  for (const url of unique) {
    const seenAt = latest.get(url);
    if (!seenAt) {
      newUrls.push(url);
      continue;
    }
    const host = hostOf(url);
    let interval = cadenceCache.get(host);
    if (interval === undefined) {
      interval = rereadIntervalFor(await readCadence(prisma, host));
      cadenceCache.set(host, interval);
    }
    if (Date.now() - seenAt.getTime() >= interval) refreshUrls.push(url);
    else unchangedCount += 1;
  }

  return { newUrls, refreshUrls, unchangedCount };
}

export interface StaleSource {
  sourceUrl: string;
  sourceHost: string;
  lastReadAt: Date;
  ageMs: number;
  rereadIntervalMs: number;
  /** How far past its interval this source is (1.0 = exactly due). */
  overdueRatio: number;
}

/**
 * The freshness schedule: known sources ordered by how overdue a revalidation
 * is, so a pass can spend its budget where change is most likely.
 */
export async function rankStaleSources(
  prisma: PrismaClient,
  opts: { limit?: number; scan?: number } = {},
): Promise<StaleSource[]> {
  const rows = await prisma.adminWorkerSourceRead
    .findMany({
      distinct: ["sourceUrl"],
      orderBy: { createdAt: "desc" },
      take: opts.scan ?? 400,
      select: { sourceUrl: true, sourceHost: true, createdAt: true, updatedAt: true },
    })
    .catch(
      () =>
        [] as Array<{
          sourceUrl: string;
          sourceHost: string;
          createdAt: Date;
          updatedAt: Date;
        }>,
    );
  if (rows.length === 0) return [];

  // One batched read of the last successful check per URL, so an unchanged page
  // that keeps answering 304 stops looking permanently overdue.
  const attempts = await prisma.adminWorkerFetchResult
    .findMany({
      where: { sourceUrl: { in: rows.map((r) => r.sourceUrl) }, succeeded: true },
      orderBy: { createdAt: "desc" },
      select: { sourceUrl: true, createdAt: true },
      take: 4_000,
    })
    .catch(() => [] as Array<{ sourceUrl: string; createdAt: Date }>);
  const lastAttemptAt = new Map<string, Date>();
  for (const a of attempts) {
    if (!lastAttemptAt.has(a.sourceUrl)) lastAttemptAt.set(a.sourceUrl, a.createdAt);
  }

  const cadenceCache = new Map<string, number>();
  const out: StaleSource[] = [];
  for (const row of rows) {
    let interval = cadenceCache.get(row.sourceHost);
    if (interval === undefined) {
      interval = rereadIntervalFor(await readCadence(prisma, row.sourceHost));
      cadenceCache.set(row.sourceHost, interval);
    }
    const checkedAt = Math.max(
      row.createdAt.getTime(),
      row.updatedAt.getTime(),
      lastAttemptAt.get(row.sourceUrl)?.getTime() ?? 0,
    );
    const ageMs = Date.now() - checkedAt;
    const overdueRatio = interval > 0 ? ageMs / interval : 0;
    if (overdueRatio >= 1) {
      out.push({
        sourceUrl: row.sourceUrl,
        sourceHost: row.sourceHost,
        lastReadAt: new Date(checkedAt),
        ageMs,
        rereadIntervalMs: interval,
        overdueRatio,
      });
    }
  }
  out.sort((a, b) => b.overdueRatio - a.overdueRatio);
  return out.slice(0, opts.limit ?? 50);
}

export interface FreshnessSweepResult {
  overdue: number;
  requeued: number;
  hosts: string[];
}

/**
 * Freshness sweep: turn "these known sources are overdue for a look" into real
 * work by re-queueing them as candidates (spec §14 "Ears", §16).
 *
 * It only re-queues sources whose learned change interval has actually
 * elapsed, and it never creates a duplicate candidate row — so a healthy,
 * caught-up corpus produces no work at all, which is the point.
 */
export async function runFreshnessSweep(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<FreshnessSweepResult> {
  const all = await rankStaleSources(prisma, { limit: (opts.limit ?? 25) * 2 });
  // Operator-supplied files are not web pages: they cannot be re-fetched, and
  // queueing them would put an unfetchable URL at the head of the fetch queue.
  const stale = all.filter((s) => /^https?:\/\//i.test(s.sourceUrl)).slice(0, opts.limit ?? 25);
  const out: FreshnessSweepResult = { overdue: stale.length, requeued: 0, hosts: [] };
  if (stale.length === 0) return out;

  for (const source of stale) {
    // A source the worker has read before already owns its candidate row
    // (discoveredUrl is unique), so revisiting means moving that row back into
    // the queue rather than creating a second one — one crawler, one queue.
    const priority = Math.min(1, 0.4 + Math.min(0.5, source.overdueRatio / 10));
    const updated = await prisma.candidateSourceUrl
      .upsert({
        where: { discoveredUrl: source.sourceUrl },
        create: {
          discoveredUrl: source.sourceUrl,
          sourceHost: source.sourceHost,
          // The URL is already known and approved; this is a deliberate
          // revisit, which is what CONFIGURED_URL means in this enum.
          discoveryMethod: "CONFIGURED_URL",
          status: "DISCOVERED",
          fetchPriority: priority,
        },
        update: {},
      })
      .catch(() => null);
    if (!updated) continue;

    // Only re-open rows that are genuinely finished with; never disturb work
    // that is currently mid-flight.
    if (updated.status === "FETCHED" || updated.status === "BUILT") {
      const reopened = await prisma.candidateSourceUrl
        .update({
          where: { id: updated.id },
          data: { status: "DISCOVERED", fetchPriority: priority },
        })
        .catch(() => null);
      if (!reopened) continue;
    } else if (updated.status !== "DISCOVERED" && updated.status !== "PRIORITIZED") {
      continue;
    }

    out.requeued += 1;
    if (!out.hosts.includes(source.sourceHost)) out.hosts.push(source.sourceHost);
  }
  return out;
}
