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
