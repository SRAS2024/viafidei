/**
 * Source reputation engine. Maintains a rolling per-(host, content
 * type) reputation row that drives the planner: TRUSTED and GOOD
 * sources are preferred; POOR sources are limited; PAUSED sources
 * are skipped until a future reputation pass promotes them back.
 *
 * Reputation is deterministic — derived only from the rates in the
 * row, not from a model. The thresholds below are the rules the
 * learning loop applies after every build outcome.
 */

import type { PrismaClient, SourceReputationTier } from "@prisma/client";

export const REPUTATION_THRESHOLDS = {
  /** Public publish rate above which the source is TRUSTED. */
  trustedPublish: 0.85,
  /** QA pass rate above which the source is GOOD. */
  goodQaPass: 0.7,
  /** Build success rate below which the source is LIMITED. */
  limitedBuild: 0.4,
  /** Wrong-content rate above which the source is POOR. */
  poorWrongContent: 0.3,
  /** Wrong-content rate above which the source is auto-PAUSED. */
  pauseWrongContent: 0.6,
  /** Build success rate below which a source is auto-PAUSED. */
  pauseBuild: 0.1,
} as const;

export interface SourceOutcomeUpdate {
  sourceHost: string;
  contentType?: string;
  sourceId?: string;
  sourceRole?: string;
  fetchOk?: boolean;
  buildOk?: boolean;
  qaOk?: boolean;
  validationOk?: boolean;
  publishedOk?: boolean;
  wrongContent?: boolean;
  duplicate?: boolean;
  usefulnessScore?: number;
}

/**
 * Update a source reputation row with a single outcome. Each rate is
 * an exponentially-weighted moving average with alpha = 0.2, so a
 * single outlier never flips the tier — the source has to consistently
 * drift in one direction.
 */
const EWMA_ALPHA = 0.2;
function ewma(prev: number, sample: number): number {
  return prev * (1 - EWMA_ALPHA) + sample * EWMA_ALPHA;
}

export function deriveTier(row: {
  publicPublishRate: number;
  qaPassRate: number;
  contentBuildSuccessRate: number;
  wrongContentRate: number;
}): { tier: SourceReputationTier; paused: boolean } {
  // Brand-new source with no signal at all — stay NEUTRAL until we
  // have actual outcomes to learn from.
  const hasSignal =
    row.publicPublishRate > 0 ||
    row.qaPassRate > 0 ||
    row.contentBuildSuccessRate > 0 ||
    row.wrongContentRate > 0;
  if (!hasSignal) return { tier: "NEUTRAL", paused: false };

  if (row.wrongContentRate >= REPUTATION_THRESHOLDS.pauseWrongContent) {
    return { tier: "PAUSED", paused: true };
  }
  if (
    row.contentBuildSuccessRate <= REPUTATION_THRESHOLDS.pauseBuild &&
    row.contentBuildSuccessRate > 0
  ) {
    return { tier: "PAUSED", paused: true };
  }
  if (row.publicPublishRate >= REPUTATION_THRESHOLDS.trustedPublish) {
    return { tier: "TRUSTED", paused: false };
  }
  if (row.qaPassRate >= REPUTATION_THRESHOLDS.goodQaPass) {
    return { tier: "GOOD", paused: false };
  }
  if (row.wrongContentRate >= REPUTATION_THRESHOLDS.poorWrongContent) {
    return { tier: "POOR", paused: false };
  }
  if (row.contentBuildSuccessRate <= REPUTATION_THRESHOLDS.limitedBuild) {
    return { tier: "LIMITED", paused: false };
  }
  return { tier: "NEUTRAL", paused: false };
}

export async function recordSourceOutcome(
  prisma: PrismaClient,
  update: SourceOutcomeUpdate,
): Promise<void> {
  const where = {
    sourceHost_contentType: {
      sourceHost: update.sourceHost,
      contentType: update.contentType ?? "",
    },
  } as const;

  const existing = await prisma.adminWorkerSourceReputation.findUnique({ where });
  const next = {
    sourceHost: update.sourceHost,
    contentType: update.contentType ?? "",
    sourceId: update.sourceId ?? existing?.sourceId ?? null,
    sourceRole: update.sourceRole ?? existing?.sourceRole ?? null,
    fetchSuccessRate: ewma(existing?.fetchSuccessRate ?? 0, boolToScore(update.fetchOk)),
    contentBuildSuccessRate: ewma(
      existing?.contentBuildSuccessRate ?? 0,
      boolToScore(update.buildOk),
    ),
    qaPassRate: ewma(existing?.qaPassRate ?? 0, boolToScore(update.qaOk)),
    validationEvidenceSuccessRate: ewma(
      existing?.validationEvidenceSuccessRate ?? 0,
      boolToScore(update.validationOk),
    ),
    publicPublishRate: ewma(existing?.publicPublishRate ?? 0, boolToScore(update.publishedOk)),
    wrongContentRate: ewma(existing?.wrongContentRate ?? 0, boolToScore(update.wrongContent)),
    duplicateRate: ewma(existing?.duplicateRate ?? 0, boolToScore(update.duplicate)),
    averageUsefulness: ewma(
      existing?.averageUsefulness ?? 0,
      update.usefulnessScore ?? existing?.averageUsefulness ?? 0,
    ),
    discoverySuccessRate: existing?.discoverySuccessRate ?? 0,
    lastScoreUpdate: new Date(),
  };

  const tierInfo = deriveTier(next);

  await prisma.adminWorkerSourceReputation.upsert({
    where,
    create: {
      ...next,
      reputationTier: tierInfo.tier,
      paused: tierInfo.paused,
    },
    update: {
      ...next,
      reputationTier: tierInfo.tier,
      paused: tierInfo.paused,
    },
  });
}

function boolToScore(b: boolean | undefined): number {
  if (b === undefined) return 0;
  return b ? 1 : 0;
}

export async function listSourcesByTier(
  prisma: PrismaClient,
  tier: SourceReputationTier,
  opts: { limit?: number } = {},
) {
  return prisma.adminWorkerSourceReputation.findMany({
    where: { reputationTier: tier },
    orderBy: { lastScoreUpdate: "desc" },
    take: opts.limit ?? 50,
  });
}

export async function listPausedSources(prisma: PrismaClient) {
  return prisma.adminWorkerSourceReputation.findMany({
    where: { paused: true },
    orderBy: { lastScoreUpdate: "desc" },
  });
}

// ── Source reputation decay (spec §19-22) ────────────────────────────
//
// Sources that have not produced valid content recently should become
// less trusted until proven again. We apply a half-life decay to the
// *positive* signals (publish / QA / build / validation / fetch /
// usefulness) so a TRUSTED source that goes quiet drifts back toward
// NEUTRAL. Negative signals (wrong-content / duplicate) decay on a
// slower half-life so a paused source isn't condemned forever but also
// isn't forgiven quickly — it must be re-proven (spec §378: "retest
// paused sources only on a slow schedule").

/** Half-life (days) for positive reputation signals. */
export const REPUTATION_POSITIVE_HALF_LIFE_DAYS = 21;
/** Half-life (days) for negative reputation signals (slower). */
export const REPUTATION_NEGATIVE_HALF_LIFE_DAYS = 45;

function halfLife(value: number, ageDays: number, halfLifeDays: number): number {
  return value * Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Decay-adjusted rates for a single reputation row given how long it has
 * been since the last successful update. Pure — used both by the
 * persisting sweep and by read-time callers that want a "current trust"
 * view without mutating the DB.
 */
export function decayedReputationRates(
  row: {
    publicPublishRate: number;
    qaPassRate: number;
    contentBuildSuccessRate: number;
    validationEvidenceSuccessRate: number;
    fetchSuccessRate: number;
    averageUsefulness: number;
    wrongContentRate: number;
    duplicateRate: number;
    lastScoreUpdate: Date | null;
  },
  now: Date = new Date(),
): {
  publicPublishRate: number;
  qaPassRate: number;
  contentBuildSuccessRate: number;
  validationEvidenceSuccessRate: number;
  fetchSuccessRate: number;
  averageUsefulness: number;
  wrongContentRate: number;
  duplicateRate: number;
  ageDays: number;
} {
  const last = (row.lastScoreUpdate ?? now).getTime();
  const ageDays = Math.max(0, (now.getTime() - last) / (24 * 60 * 60 * 1000));
  return {
    publicPublishRate: halfLife(row.publicPublishRate, ageDays, REPUTATION_POSITIVE_HALF_LIFE_DAYS),
    qaPassRate: halfLife(row.qaPassRate, ageDays, REPUTATION_POSITIVE_HALF_LIFE_DAYS),
    contentBuildSuccessRate: halfLife(
      row.contentBuildSuccessRate,
      ageDays,
      REPUTATION_POSITIVE_HALF_LIFE_DAYS,
    ),
    validationEvidenceSuccessRate: halfLife(
      row.validationEvidenceSuccessRate,
      ageDays,
      REPUTATION_POSITIVE_HALF_LIFE_DAYS,
    ),
    fetchSuccessRate: halfLife(row.fetchSuccessRate, ageDays, REPUTATION_POSITIVE_HALF_LIFE_DAYS),
    averageUsefulness: halfLife(row.averageUsefulness, ageDays, REPUTATION_POSITIVE_HALF_LIFE_DAYS),
    wrongContentRate: halfLife(row.wrongContentRate, ageDays, REPUTATION_NEGATIVE_HALF_LIFE_DAYS),
    duplicateRate: halfLife(row.duplicateRate, ageDays, REPUTATION_NEGATIVE_HALF_LIFE_DAYS),
    ageDays,
  };
}

/**
 * Walk every reputation row and persist the decayed rates + re-derived
 * tier. Run this on a slow schedule (e.g. once a day) so sources that
 * have gone quiet lose their high tier until they produce valid content
 * again. A paused source whose negative signal has fully decayed is
 * un-paused back to NEUTRAL so it can be re-tested (spec §378).
 */
export async function decaySourceReputation(
  prisma: PrismaClient,
  opts: { now?: Date; minAgeDays?: number } = {},
): Promise<{ decayed: number; demoted: number; retestable: number }> {
  const now = opts.now ?? new Date();
  const minAgeDays = opts.minAgeDays ?? 7;
  const rows = await prisma.adminWorkerSourceReputation.findMany();
  let decayed = 0;
  let demoted = 0;
  let retestable = 0;
  for (const row of rows) {
    const d = decayedReputationRates(row, now);
    if (d.ageDays < minAgeDays) continue;
    const tierInfo = deriveTier({
      publicPublishRate: d.publicPublishRate,
      qaPassRate: d.qaPassRate,
      contentBuildSuccessRate: d.contentBuildSuccessRate,
      wrongContentRate: d.wrongContentRate,
    });
    // Decay must never NEWLY pause a source. Pausing is an active-signal
    // decision (real wrong content / failed builds); a source that has
    // merely gone quiet must drift back toward NEUTRAL, not get parked in
    // PAUSED because its build-success rate decayed through the
    // (0, pauseBuild] band (spec §378). So a not-previously-paused source
    // can never come out of decay paused, and a PAUSED tier with no real
    // pause maps back to NEUTRAL.
    const wasPaused = row.paused;
    const nowPaused = wasPaused ? tierInfo.paused : false;
    const nextTier: SourceReputationTier =
      !nowPaused && tierInfo.tier === "PAUSED" ? "NEUTRAL" : tierInfo.tier;
    // A previously-paused source whose negative signal has decayed below
    // the pause threshold becomes retestable (un-paused to NEUTRAL).
    if (nextTier !== row.reputationTier) demoted += 1;
    if (wasPaused && !nowPaused) retestable += 1;
    await prisma.adminWorkerSourceReputation
      .update({
        where: { id: row.id },
        data: {
          publicPublishRate: d.publicPublishRate,
          qaPassRate: d.qaPassRate,
          contentBuildSuccessRate: d.contentBuildSuccessRate,
          validationEvidenceSuccessRate: d.validationEvidenceSuccessRate,
          fetchSuccessRate: d.fetchSuccessRate,
          averageUsefulness: d.averageUsefulness,
          wrongContentRate: d.wrongContentRate,
          duplicateRate: d.duplicateRate,
          reputationTier: nextTier,
          paused: nowPaused,
          // Re-anchor the decay clock to now. The decayed rates are
          // persisted and read directly by the planner, so the *next*
          // sweep must decay only by the newly-elapsed interval. Without
          // this re-anchor the persisted rate is decayed again from the
          // original outcome on every maintenance pass (compounding far
          // past a true half-life), and the minAgeDays gate becomes dead
          // code once a source ages past it once.
          lastScoreUpdate: now,
        },
      })
      .catch(() => undefined);
    decayed += 1;
  }
  return { decayed, demoted, retestable };
}

// ── Unclassifiable URL SHAPES (the gcatholic /dioceses/diocese/* loop) ───────
//
// A source can be perfectly healthy at the HTTP level and still hand the worker
// pages that no Via Fidei content type can ever match. Production, 2026-09-10:
// SOURCE_FETCH failed/needed-repair 21× in 6h with 0 successes, and every one of
// those "failures" was a SUCCESSFUL fetch of a gcatholic.org DIOCESE page —
// /dioceses/diocese/dall0, /dave0, /desm0, /detr0, /dubu0, /croo0 — that the
// classifier then scored at 0.05-0.25 against the 0.55 threshold. Via Fidei has
// no DIOCESE content type, so those pages are structurally unpublishable: no
// amount of retrying, rerouting or re-reading can change the verdict.
//
// The host-level reputation row above cannot express this: gcatholic.org is a
// legitimate approved authority whose parish/church pages are useful, and
// pausing the whole host to stop one directory section would throw away real
// content. The unit that is unusable is the URL SHAPE — host + parent path —
// so that is the unit this learns on.
//
// Deliberately DERIVED state, exactly like `blockedFetchHosts` in the
// dispatcher: it is computed from CandidateSourceUrl rows the pipeline already
// writes (`rejectionPattern`), so there is no new table, no new migration and
// nothing to garbage-collect. That also makes it reversible three separate
// ways — see `unclassifiablePrefixes`.

/**
 * Marker written to `CandidateSourceUrl.rejectionPattern` when a page was
 * fetched and read successfully but the classifier could match NO content type.
 * This is the evidence `unclassifiablePrefixes` learns from, and it is what
 * distinguishes "this page can never be published" from a transient fetch
 * failure (which must keep retrying — see `classifyFetchFailure`).
 */
export const UNCLASSIFIABLE_REJECTION_PATTERN = "classifier:no-matching-content-type";

/** Classifier verdicts that mean "no content type can match this page". */
export const UNCLASSIFIABLE_READ_TYPES: readonly string[] = ["UNUSABLE", "WRONG"];

/**
 * Classifier rejections of one URL before it stops being re-queued. Two, not
 * one: a page can legitimately fail to classify once (a partial render, a body
 * the reader parsed badly) and deserve a single second look after its freshness
 * interval. Two rejections of the same URL is a verdict, not an accident.
 */
export const MAX_CLASSIFIER_REJECTIONS = 2;

/** Sibling URLs under one prefix that must be classifier-rejected before discovery stops the prefix. */
export const UNCLASSIFIABLE_PREFIX_MIN_SIBLINGS = 5;

/**
 * How far back sibling evidence is measured — and therefore how long a
 * suppression can last without fresh evidence. A suppressed prefix whose
 * rejections all age out of this window is discovered again and re-tested,
 * which is the same "re-prove it" philosophy as the reputation decay above.
 */
export const UNCLASSIFIABLE_PREFIX_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The URL SHAPE a page belongs to: host + parent path, lowercased.
 *
 *   https://gcatholic.org/dioceses/diocese/dall0 → gcatholic.org/dioceses/diocese
 *
 * Returns null when the URL has fewer than two path segments, so the prefix is
 * ALWAYS a real subdirectory and this can never degenerate into a host-wide
 * blocklist: `https://gcatholic.org/dioceses/` and `https://gcatholic.org/` both
 * yield null and are never suppressed.
 */
export function urlShapePrefix(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  return `${parsed.host}/${segments.slice(0, -1).join("/")}`.toLowerCase();
}

/** `host/path` for prefix comparison — no scheme, no query, no fragment. */
function hostPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when `url` sits under one of the suppressed prefixes — the prefix itself
 * or anything below it. Cheap by design: the suppressed set is tiny (a handful
 * of prefixes at most) and this runs per discovered link.
 */
export function isSuppressedUrlShape(url: string, prefixes: ReadonlySet<string>): boolean {
  if (prefixes.size === 0) return false;
  const path = hostPath(url);
  if (!path) return false;
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export interface UnclassifiablePrefix {
  /** host + parent path, e.g. `gcatholic.org/dioceses/diocese`. */
  prefix: string;
  host: string;
  /** Distinct candidate URLs under the prefix the classifier could not type. */
  rejectedUrls: number;
  /** Up to three real URLs, so the log line and the operator view are concrete. */
  examples: string[];
}

/**
 * URL shapes discovery should stop surfacing: at least
 * `minSiblings` DIFFERENT URLs under the same host+parent-path were fetched
 * successfully and then rejected by the classifier for matching no content
 * type, and NOTHING under that shape classified successfully in the same
 * window.
 *
 * Three independent ways out, so this is a deprioritisation and not a permanent
 * blocklist:
 *   1. one page under the shape that DOES classify clears it immediately;
 *   2. the evidence ages out of `UNCLASSIFIABLE_PREFIX_WINDOW_MS` and the shape
 *      is discovered and re-tested from scratch;
 *   3. it is derived, so clearing `rejectionPattern` on those candidate rows
 *      (an operator action, no migration) clears the suppression.
 *
 * Fail-open: any error returns an empty list, i.e. discovery behaves exactly as
 * it did before. Suppressing nothing is always the safe direction.
 */
export async function unclassifiablePrefixes(
  prisma: PrismaClient,
  opts: { nowMs?: number; minSiblings?: number; windowMs?: number } = {},
): Promise<UnclassifiablePrefix[]> {
  const nowMs = opts.nowMs ?? Date.now();
  const minSiblings = opts.minSiblings ?? UNCLASSIFIABLE_PREFIX_MIN_SIBLINGS;
  const since = new Date(nowMs - (opts.windowMs ?? UNCLASSIFIABLE_PREFIX_WINDOW_MS));
  try {
    const rejected = (await prisma.candidateSourceUrl.findMany({
      where: {
        rejectionPattern: UNCLASSIFIABLE_REJECTION_PATTERN,
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      take: 2000,
      select: { discoveredUrl: true, sourceHost: true },
    })) as Array<{ discoveredUrl: string; sourceHost: string }>;

    const byPrefix = new Map<string, UnclassifiablePrefix>();
    const seenUrls = new Set<string>();
    for (const row of rejected) {
      if (seenUrls.has(row.discoveredUrl)) continue;
      seenUrls.add(row.discoveredUrl);
      const prefix = urlShapePrefix(row.discoveredUrl);
      if (!prefix) continue;
      const entry = byPrefix.get(prefix) ?? {
        prefix,
        host: row.sourceHost,
        rejectedUrls: 0,
        examples: [],
      };
      entry.rejectedUrls += 1;
      if (entry.examples.length < 3) entry.examples.push(row.discoveredUrl);
      byPrefix.set(prefix, entry);
    }

    const overThreshold = [...byPrefix.values()].filter((e) => e.rejectedUrls >= minSiblings);
    if (overThreshold.length === 0) return [];

    // Way out #1: one page under the shape that the classifier DID type proves
    // the shape is usable, so the whole prefix comes back. Scoped to the hosts
    // actually implicated so this stays a small query.
    const hosts = [...new Set(overThreshold.map((e) => e.host))];
    const proven = (await prisma.adminWorkerSourceRead
      .findMany({
        where: {
          sourceHost: { in: hosts },
          createdAt: { gte: since },
          detectedContentType: { notIn: [...UNCLASSIFIABLE_READ_TYPES], not: null },
        },
        select: { sourceUrl: true },
        take: 2000,
      })
      .catch(() => [] as Array<{ sourceUrl: string }>)) as Array<{ sourceUrl: string }>;
    const provenPaths: string[] = [];
    for (const row of proven) {
      const path = hostPath(row.sourceUrl);
      if (path) provenPaths.push(path);
    }

    return overThreshold
      .filter((e) => !provenPaths.some((p) => p === e.prefix || p.startsWith(`${e.prefix}/`)))
      .sort((a, b) => b.rejectedUrls - a.rejectedUrls);
  } catch {
    return [];
  }
}

/**
 * How long `suppressedUrlPrefixes` reuses its last answer within one process.
 *
 * `unclassifiablePrefixes` filters on `rejectionPattern`, which is not indexed,
 * so on a CandidateSourceUrl table with hundreds of thousands of rows it is a
 * scan. Every discovery pass and every SOURCE_FETCH pass wants the answer, and
 * the answer changes on the order of hours (a shape needs several sibling
 * rejections to appear, and a single success to disappear), so caching it for a
 * few minutes costs nothing in accuracy: the worst case is that a shape stays
 * suppressed, or stays live, for one extra cache window.
 */
export const SUPPRESSED_PREFIX_CACHE_MS = 10 * 60 * 1000;

let suppressedPrefixCache: { at: number; prefixes: Set<string> } | null = null;

/** Drop the memoized suppression set (tests, and any forced re-read). */
export function clearSuppressedPrefixCache(): void {
  suppressedPrefixCache = null;
}

/**
 * `unclassifiablePrefixes` as the set the discovery modules filter against,
 * memoized for `SUPPRESSED_PREFIX_CACHE_MS`. Pass explicit `opts` to bypass the
 * cache and compute a fresh answer.
 */
export async function suppressedUrlPrefixes(
  prisma: PrismaClient,
  opts: { nowMs?: number; minSiblings?: number; windowMs?: number } = {},
): Promise<Set<string>> {
  const explicit =
    opts.nowMs !== undefined || opts.minSiblings !== undefined || opts.windowMs !== undefined;
  const now = Date.now();
  if (
    !explicit &&
    suppressedPrefixCache &&
    now - suppressedPrefixCache.at < SUPPRESSED_PREFIX_CACHE_MS
  ) {
    return suppressedPrefixCache.prefixes;
  }
  const rows = await unclassifiablePrefixes(prisma, opts);
  const prefixes = new Set(rows.map((r) => r.prefix));
  if (!explicit) suppressedPrefixCache = { at: now, prefixes };
  return prefixes;
}
