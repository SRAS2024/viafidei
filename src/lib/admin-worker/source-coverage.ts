/**
 * SourceCoverage scoring (spec §23). Each content type needs enough
 * configured sources to actually reach goal. A content type with 1
 * primary source can never publish more variety than that source
 * provides; the worker should not lower quality to compensate.
 *
 * Coverage components:
 *   - number of primary sources (TRUSTED + approved authority)
 *   - number of validation sources (used by the verifier)
 *   - number of enrichment sources (Catechism / cross-references)
 *   - recent successful candidates (7d)
 *   - recent valid packages (7d)
 *   - recent public publishes (7d)
 *
 * A composite coverageScore in [0,1] drives the
 * blockedByCoverage flag — when score < 0.4 the type is flagged
 * and the Developer Audit surfaces it as a coverage gap.
 */

import type { PrismaClient } from "@prisma/client";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Per-content-type minimum primary sources before unblocking. */
const MIN_PRIMARY_SOURCES: Record<string, number> = {
  PRAYER: 2,
  SAINT: 2,
  APPARITION: 2,
  NOVENA: 2,
  DEVOTION: 2,
  ROSARY: 1,
  CONSECRATION: 1,
  SACRAMENT: 2,
  CHURCH_DOCUMENT: 2,
  LITURGICAL: 2,
  PARISH: 1,
};

export interface CoverageRow {
  contentType: string;
  primarySources: number;
  validationSources: number;
  enrichmentSources: number;
  recentCandidates7d: number;
  recentValidPackages7d: number;
  recentPublishes7d: number;
  coverageScore: number;
  blockedByCoverage: boolean;
  blockReason: string | null;
  recommendation: string | null;
}

export async function runSourceCoverage(prisma: PrismaClient): Promise<CoverageRow[]> {
  const goals = await prisma.contentGoal.findMany();
  const now = Date.now();
  const since = new Date(now - SEVEN_DAYS_MS);

  const rows: CoverageRow[] = [];

  for (const goal of goals) {
    const ct = goal.contentType;

    // Count approved sources by role for this content type. Authority
    // sources don't carry per-type tags today, so we treat the count
    // of distinct TRUSTED hosts in source reputation as a proxy for
    // primary sources, with role tags from authoritySource when
    // available.
    const [primary, validation, enrichment, recentCandidates, recentBuilds, recentPublishes] =
      await Promise.all([
        prisma.authoritySource
          .count({ where: { authorityLevel: { in: ["VATICAN", "USCCB", "CATECHISM"] } } })
          .catch(() => 0),
        prisma.adminWorkerSourceReputation
          .count({ where: { sourceRole: "validation_source" } })
          .catch(() => 0),
        prisma.adminWorkerSourceReputation
          .count({ where: { sourceRole: "enrichment_source" } })
          .catch(() => 0),
        prisma.candidateSourceUrl
          .count({
            where: {
              predictedContentType: ct,
              status: { in: ["DISCOVERED", "PRIORITIZED", "FETCHED", "BUILT"] },
              createdAt: { gte: since },
            },
          })
          .catch(() => 0),
        prisma.workerBuildJob
          .count({
            where: {
              status: "succeeded",
              checklistItem: { contentType: ct as never },
              finishedAt: { gte: since },
            },
          })
          .catch(() => 0),
        prisma.publishedContent
          .count({
            where: { contentType: ct as never, isPublished: true, publishedAt: { gte: since } },
          })
          .catch(() => 0),
      ]);

    const minPrimary = MIN_PRIMARY_SOURCES[ct] ?? 2;
    const primaryRatio = Math.min(1, primary / minPrimary);
    const validationRatio = Math.min(1, validation / 1);
    const enrichmentRatio = Math.min(1, enrichment / 1);

    // Healthy candidate / build / publish activity is also part of
    // coverage — having sources configured is not the same as having
    // those sources work.
    const activitySignal =
      Math.min(1, recentCandidates / 5) * 0.3 +
      Math.min(1, recentBuilds / 3) * 0.3 +
      Math.min(1, recentPublishes / 2) * 0.4;

    const coverageScore =
      primaryRatio * 0.35 + validationRatio * 0.15 + enrichmentRatio * 0.1 + activitySignal * 0.4;

    const blockedByCoverage = coverageScore < 0.4 && goal.gapCount > 0;

    const blockReason = blockedByCoverage
      ? primary < minPrimary
        ? `${ct} has ${primary}/${minPrimary} primary sources configured.`
        : recentCandidates === 0
          ? `${ct} has primary sources but no candidate URLs surfaced in last 7 days.`
          : recentPublishes === 0 && recentBuilds === 0
            ? `${ct} has candidates but no successful builds or publishes in last 7 days.`
            : `${ct} source coverage score ${coverageScore.toFixed(2)} below threshold.`
      : null;

    const recommendation = blockedByCoverage
      ? primary < minPrimary
        ? `Add ${minPrimary - primary} more approved primary source(s) for ${ct} via the source registry.`
        : recentCandidates === 0
          ? `Run a DiscoveryOrchestrator pass; check that approved hosts have sitemaps that surface ${ct} URLs.`
          : `Check classifier + extractor: candidates exist but builds aren't completing for ${ct}.`
      : null;

    const row: CoverageRow = {
      contentType: ct,
      primarySources: primary,
      validationSources: validation,
      enrichmentSources: enrichment,
      recentCandidates7d: recentCandidates,
      recentValidPackages7d: recentBuilds,
      recentPublishes7d: recentPublishes,
      coverageScore: round(coverageScore),
      blockedByCoverage,
      blockReason,
      recommendation,
    };
    rows.push(row);

    await prisma.adminWorkerSourceCoverage
      .upsert({
        where: { contentType: ct },
        create: row,
        update: row,
      })
      .catch(() => undefined);
  }

  return rows;
}

export async function listCoverageBlocked(prisma: PrismaClient) {
  return prisma.adminWorkerSourceCoverage
    .findMany({
      where: { blockedByCoverage: true },
      orderBy: { coverageScore: "asc" },
    })
    .catch(() => []);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
