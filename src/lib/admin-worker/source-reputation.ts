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
