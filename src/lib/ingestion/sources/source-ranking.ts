/**
 * Source quality ranking (spec §4).
 *
 * Reads SourceQualityScore + IngestionSource state and produces a
 * priority-ranked list per content type. Sources are prioritised by:
 *
 *   - high build success rate
 *   - high QA pass rate
 *   - high public package rate (qaPass / (qaPass + qaFail))
 *   - low duplicate rate
 *   - low wrong-content rate
 *   - strong validation evidence (sources with validation_source or
 *     primary_content_source roles)
 *
 * Demote sources with:
 *   - low build success
 *   - high QA failure
 *   - high wrong-content rate
 *   - high duplicate rate
 *   - missing required fields (no role / no purposes)
 *   - poor source configuration (not_configured / paused)
 *
 * The output drives the planner's source-selection pass: when the
 * factory has more candidates than the daily cap allows, the top of
 * the ranking gets picked first.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";

export type SourceRankingRow = {
  sourceId: string;
  host: string;
  contentType: string;
  rank: number;
  /** Composite quality score 0..1. */
  score: number;
  /** Why the row scored where it did (top promotion / demotion reasons). */
  factors: string[];
};

export type SourceRankingReport = {
  rows: ReadonlyArray<SourceRankingRow>;
  generatedAt: Date;
};

type ScoreRow = {
  sourceId: string;
  contentType: string;
  buildSuccessCount: number;
  buildFailureCount: number;
  qaPassCount: number;
  qaFailCount: number;
  wrongContentCount: number;
  duplicateCount: number;
  deletedCount: number;
  validPackageRate: number | null;
};

type SourceRow = {
  id: string;
  host: string;
  role: string;
  pausedAt: Date | null;
  discoveryMethod: string | null;
  isActive: boolean;
};

function computeScore(s: ScoreRow, src: SourceRow): { score: number; factors: string[] } {
  const attempts = s.buildSuccessCount + s.buildFailureCount;
  const qaAttempts = s.qaPassCount + s.qaFailCount;
  const factors: string[] = [];

  // Build success rate (0..1).
  const buildRate = attempts === 0 ? 0 : s.buildSuccessCount / attempts;
  // QA pass rate (0..1).
  const qaRate = qaAttempts === 0 ? 0 : s.qaPassCount / qaAttempts;
  // Wrong-content rate is a penalty.
  const wrongRate = attempts === 0 ? 0 : s.wrongContentCount / attempts;
  // Duplicate rate is a smaller penalty.
  const dupRate = attempts === 0 ? 0 : s.duplicateCount / attempts;

  // Role bonus: primary > validation > enrichment > discovery_only.
  let roleBonus = 0;
  switch (src.role) {
    case "primary_content_source":
      roleBonus = 0.15;
      factors.push("role: primary");
      break;
    case "validation_source":
      roleBonus = 0.1;
      factors.push("role: validation");
      break;
    case "enrichment_source":
      roleBonus = 0.05;
      factors.push("role: enrichment");
      break;
    case "discovery_only_source":
      factors.push("role: discovery-only");
      break;
    case "rejected_source":
      factors.push("role: rejected (DEMOTED)");
      break;
  }

  // Hard demotions:
  if (!src.isActive) factors.push("inactive (DEMOTED)");
  if (src.pausedAt) factors.push("paused (DEMOTED)");
  if (!src.discoveryMethod || src.discoveryMethod === "not_configured")
    factors.push("not_configured (DEMOTED)");

  const base = 0.4 * buildRate + 0.4 * qaRate + roleBonus;
  let penalty = 0;
  if (wrongRate > 0) {
    penalty += wrongRate * 0.5;
    factors.push(`wrong-content ${(wrongRate * 100).toFixed(0)}%`);
  }
  if (dupRate > 0) {
    penalty += dupRate * 0.2;
    factors.push(`duplicate ${(dupRate * 100).toFixed(0)}%`);
  }
  if (
    !src.isActive ||
    src.pausedAt ||
    !src.discoveryMethod ||
    src.discoveryMethod === "not_configured" ||
    src.role === "rejected_source"
  ) {
    return { score: 0, factors };
  }
  const score = Math.max(0, Math.min(1, base - penalty));
  if (buildRate >= 0.8) factors.push("strong build rate");
  if (qaRate >= 0.8) factors.push("strong QA pass rate");
  return { score, factors };
}

export async function buildSourceRankingReport(
  opts: {
    contentType?: string | null;
    limit?: number;
  } = {},
): Promise<SourceRankingReport> {
  const generatedAt = new Date();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  let scores: ScoreRow[] = [];
  let sources: SourceRow[] = [];
  try {
    scores = (await prisma.sourceQualityScore.findMany({
      where: opts.contentType ? { contentType: opts.contentType } : {},
      take: limit,
    })) as unknown as ScoreRow[];
    const sourceIds = [...new Set(scores.map((s) => s.sourceId))];
    if (sourceIds.length > 0) {
      sources = (await prisma.ingestionSource.findMany({
        where: { id: { in: sourceIds } },
        select: {
          id: true,
          host: true,
          role: true,
          pausedAt: true,
          discoveryMethod: true,
          isActive: true,
        },
      })) as unknown as SourceRow[];
    }
  } catch (e) {
    logger.warn("source-ranking.read_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { rows: [], generatedAt };
  }

  const sourceMap = new Map<string, SourceRow>();
  for (const s of sources) sourceMap.set(s.id, s);

  const rows: SourceRankingRow[] = [];
  for (const s of scores) {
    const src = sourceMap.get(s.sourceId);
    if (!src) continue;
    const { score, factors } = computeScore(s, src);
    rows.push({
      sourceId: s.sourceId,
      host: src.host,
      contentType: s.contentType,
      rank: 0, // assigned below
      score,
      factors,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));

  return { rows, generatedAt };
}
