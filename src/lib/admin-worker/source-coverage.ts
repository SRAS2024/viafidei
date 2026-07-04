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
  /** Spec §11: sources not paused (i.e. eligible to be used right now). */
  activeSourceCount: number;
  /** Spec §11: distinct hosts that succeeded for this type in the last 7d. */
  recentlySuccessfulSources: number;
  /** Spec §11: distinct hosts that failed for this type in the last 7d. */
  recentlyFailedSources: number;
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

  // The curated knowledge base is a GUARANTEED, always-reachable content source
  // (it ships in-repo, no network needed). A type with curated entries can never
  // be "blocked by source coverage" — it has a source of truth to build from.
  // Crediting it stops the score from flagging types as blocked merely because
  // they had no fresh web activity in the last 7 days.
  const curatedByType: Record<string, number> = await import("@/lib/checklist")
    .then((m) => m.curatedKnowledgeByType() as Record<string, number>)
    .catch(() => ({}));

  const rows: CoverageRow[] = [];

  for (const goal of goals) {
    const ct = goal.contentType;

    // Count approved sources by role for this content type. Authority
    // sources don't carry per-type tags today, so we treat the count
    // of distinct TRUSTED hosts in source reputation as a proxy for
    // primary sources, with role tags from authoritySource when
    // available.
    const [
      primary,
      validation,
      enrichment,
      recentCandidates,
      recentBuilds,
      recentPublishes,
      activeSourceCount,
      recentlySuccessfulSources,
      recentlyFailedSources,
    ] = await Promise.all([
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
      // Spec §11: active sources = reputation rows for this type (or
      // global) that are NOT paused.
      prisma.adminWorkerSourceReputation
        .count({
          where: {
            paused: false,
            OR: [{ contentType: ct }, { contentType: null }],
          },
        })
        .catch(() => 0),
      // Spec §11: hosts scored recently (last 7d) with a healthy fetch
      // success rate — a proxy for "recently successful sources".
      prisma.adminWorkerSourceReputation
        .count({
          where: {
            OR: [{ contentType: ct }, { contentType: null }],
            lastScoreUpdate: { gte: since },
            fetchSuccessRate: { gte: 0.5 },
            paused: false,
          },
        })
        .catch(() => 0),
      // Spec §11: hosts scored recently that are paused or have a poor
      // fetch success rate — a proxy for "recently failed sources".
      prisma.adminWorkerSourceReputation
        .count({
          where: {
            lastScoreUpdate: { gte: since },
            AND: [
              { OR: [{ contentType: ct }, { contentType: null }] },
              { OR: [{ paused: true }, { fetchSuccessRate: { lt: 0.5 } }] },
            ],
          },
        })
        .catch(() => 0),
    ]);

    const minPrimary = MIN_PRIMARY_SOURCES[ct] ?? 2;
    const primaryRatio = Math.min(1, primary / minPrimary);
    const validationRatio = Math.min(1, validation / 1);
    const enrichmentRatio = Math.min(1, enrichment / 1);
    const curatedCount = curatedByType[ct] ?? 0;
    // 3+ curated entries = a solid always-available source of truth for the type.
    const curatedRatio = Math.min(1, curatedCount / 3);

    // Healthy candidate / build / publish activity is also part of
    // coverage — having sources configured is not the same as having
    // those sources work.
    const activitySignal =
      Math.min(1, recentCandidates / 5) * 0.3 +
      Math.min(1, recentBuilds / 3) * 0.3 +
      Math.min(1, recentPublishes / 2) * 0.4;

    const coverageScore =
      primaryRatio * 0.3 +
      curatedRatio * 0.2 +
      validationRatio * 0.1 +
      enrichmentRatio * 0.05 +
      activitySignal * 0.35;

    // A type is only genuinely "blocked by source coverage" when it has NO way
    // to produce content: no curated knowledge base AND too few primary sources.
    // A weak score with a curated KB (or enough primaries) is a scheduling/idle
    // state — the worker just hasn't prioritised the type recently — NOT a
    // coverage block, so it must not read as a hard failure demanding "add
    // sources" when sources already exist.
    const hasContentSource = curatedCount > 0 || primary >= minPrimary;
    const blockedByCoverage = goal.gapCount > 0 && !hasContentSource && coverageScore < 0.4;

    const blockReason = blockedByCoverage
      ? primary < minPrimary
        ? `${ct} has ${primary}/${minPrimary} primary sources configured and no curated knowledge.`
        : `${ct} source coverage score ${coverageScore.toFixed(2)} below threshold with no curated fallback.`
      : null;

    const recommendation = blockedByCoverage
      ? `Add ${Math.max(1, minPrimary - primary)} approved primary source(s) for ${ct} via the source registry, or seed curated ${ct} entries.`
      : null;

    const row: CoverageRow = {
      contentType: ct,
      primarySources: primary,
      validationSources: validation,
      enrichmentSources: enrichment,
      activeSourceCount,
      recentlySuccessfulSources,
      recentlyFailedSources,
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
