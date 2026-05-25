/**
 * Source ranking. The Admin Worker keeps a ranked source plan (spec
 * section 19): the planner draws from the top of the rank when it
 * needs a source for a content type.
 *
 * Each source gets a single deterministic rank score combining ten
 * criteria. Higher = better. Sources currently paused by the
 * reputation engine are excluded from the rank.
 */

import type {
  AdminWorkerSourceReputation,
  AuthoritySource,
  PrismaClient,
  SourceAuthorityLevel,
} from "@prisma/client";

import { rankHostsByMemory } from "./memory";

/** Authority-level weight (spec: "prefer official Church sources"). */
const AUTHORITY_WEIGHTS: Record<SourceAuthorityLevel, number> = {
  VATICAN: 1.0,
  CATECHISM: 0.95,
  LITURGICAL_BOOK: 0.9,
  USCCB: 0.85,
  DIOCESAN: 0.7,
  RELIGIOUS_ORDER: 0.65,
  TRUSTED_PUBLISHER: 0.55,
  ACADEMIC: 0.5,
  COMMUNITY: 0.35,
};

export interface RankedSource {
  sourceHost: string;
  sourceId?: string;
  authorityLevel: SourceAuthorityLevel | null;
  rank: number;
  reasons: string[];
}

/**
 * Combine reputation rates + authority level into a single rank. The
 * formula is deterministic: same inputs always produce the same rank.
 *
 * Weights are tuned so that:
 *   - a Vatican source with healthy QA always outranks a community
 *     source with healthy QA;
 *   - a TRUSTED community source can still rank highly when it
 *     consistently produces valid content;
 *   - chronic wrong-content sources fall to the bottom.
 */
export function rankSource(
  authoritySource: Pick<AuthoritySource, "authorityLevel" | "host"> | null,
  reputation: AdminWorkerSourceReputation | null,
): RankedSource {
  const host = authoritySource?.host ?? reputation?.sourceHost ?? "";
  const authorityLevel = authoritySource?.authorityLevel ?? null;
  const credibility = authorityLevel != null ? (AUTHORITY_WEIGHTS[authorityLevel] ?? 0.4) : 0.4;

  const rates = reputation
    ? {
        publicPublishRate: reputation.publicPublishRate,
        qaPassRate: reputation.qaPassRate,
        validationEvidenceSuccessRate: reputation.validationEvidenceSuccessRate,
        fetchSuccessRate: reputation.fetchSuccessRate,
        contentBuildSuccessRate: reputation.contentBuildSuccessRate,
        duplicateRate: reputation.duplicateRate,
        wrongContentRate: reputation.wrongContentRate,
        averageUsefulness: reputation.averageUsefulness,
      }
    : null;

  // Section 19 criteria, each contributing a weighted score in [0,1].
  const components = {
    credibility, // weight 0.30
    sourceRole: authorityLevel ? 1 : 0.4, // weight 0.05
    publishRate: rates?.publicPublishRate ?? 0, // weight 0.15
    qaPassRate: rates?.qaPassRate ?? 0, // weight 0.10
    validationUsefulness: rates?.validationEvidenceSuccessRate ?? 0, // weight 0.10
    fetchReliability: rates?.fetchSuccessRate ?? 0, // weight 0.05
    duplicatePenalty: 1 - (rates?.duplicateRate ?? 0), // weight 0.05
    wrongContentPenalty: 1 - (rates?.wrongContentRate ?? 0), // weight 0.10
    legalUsability: authoritySource ? 1 : 0.5, // weight 0.05 — approved sources are legally usable
    contentTypeCoverage: rates ? Math.min(1, rates.averageUsefulness) : 0.5, // weight 0.05
  };
  const weights = {
    credibility: 0.3,
    sourceRole: 0.05,
    publishRate: 0.15,
    qaPassRate: 0.1,
    validationUsefulness: 0.1,
    fetchReliability: 0.05,
    duplicatePenalty: 0.05,
    wrongContentPenalty: 0.1,
    legalUsability: 0.05,
    contentTypeCoverage: 0.05,
  };
  let rank = 0;
  for (const [key, weight] of Object.entries(weights)) {
    rank += weight * (components[key as keyof typeof components] ?? 0);
  }

  const reasons: string[] = [];
  if (authorityLevel) reasons.push(`authority=${authorityLevel}`);
  if (reputation) reasons.push(`tier=${reputation.reputationTier}`);
  if (rates?.wrongContentRate && rates.wrongContentRate > 0.2)
    reasons.push(`wrong-content rate ${rates.wrongContentRate.toFixed(2)}`);
  if (rates?.publicPublishRate && rates.publicPublishRate > 0.5)
    reasons.push(`publish rate ${rates.publicPublishRate.toFixed(2)}`);

  return {
    sourceHost: host,
    sourceId: undefined,
    authorityLevel,
    rank: Math.max(0, Math.min(1, rank)),
    reasons,
  };
}

/**
 * Load the ranked source plan, optionally filtered to a content type.
 * Paused sources are excluded.
 */
export async function rankedSourcePlan(
  prisma: PrismaClient,
  opts: { contentType?: string; limit?: number } = {},
): Promise<RankedSource[]> {
  const [authoritySources, reputations] = await Promise.all([
    prisma.authoritySource.findMany(),
    prisma.adminWorkerSourceReputation.findMany({
      where: {
        paused: false,
        ...(opts.contentType ? { contentType: opts.contentType } : {}),
      },
    }),
  ]);

  const byHost = new Map<string, AuthoritySource>();
  for (const auth of authoritySources) byHost.set(auth.host, auth);

  // Index reputations by host so we can rank every approved source
  // even when no reputation rows exist for it yet.
  const repsByHost = new Map<string, AdminWorkerSourceReputation>();
  for (const rep of reputations) {
    const existing = repsByHost.get(rep.sourceHost);
    if (!existing || rep.lastScoreUpdate > existing.lastScoreUpdate) {
      repsByHost.set(rep.sourceHost, rep);
    }
  }

  const hosts = new Set<string>([...byHost.keys(), ...repsByHost.keys()]);
  const ranked: RankedSource[] = [];
  for (const host of hosts) {
    const auth = byHost.get(host);
    const rep = repsByHost.get(host);
    if (rep?.paused) continue;
    ranked.push(rankSource(auth ?? null, rep ?? null));
  }

  // Memory tilt: nudge ranks up/down based on Laplace-smoothed
  // per-host extractor outcomes. Memory never moves a Vatican source
  // below a community source — the credibility weight dominates — but
  // it does break ties between similarly-credible hosts.
  const memoryConfidence = new Map<string, number>(
    (await rankHostsByMemory(prisma, [...hosts])).map((row) => [row.host, row.confidence]),
  );
  for (const row of ranked) {
    const conf = memoryConfidence.get(row.sourceHost) ?? 0.5;
    // Centre at 0.5 (Laplace default) → effect range ±0.05.
    const tilt = (conf - 0.5) * 0.1;
    row.rank = Math.max(0, Math.min(1, row.rank + tilt));
    if (Math.abs(tilt) > 0.01) row.reasons.push(`memory=${conf.toFixed(2)}`);
  }

  ranked.sort((a, b) => b.rank - a.rank);
  return ranked.slice(0, opts.limit ?? 50);
}
