/**
 * Per-source audit lookup. Answers the 10/10 spec question:
 * "Why is each source trusted or paused?"
 *
 * Returns the full health + quality history of one IngestionSource:
 *   - tier + isOfficial flag (Catholic Church / publisher / general)
 *   - healthState (active / failing / blocked / exhausted / paused)
 *   - pausedAt / pausedReason / autoPaused (why it's currently paused)
 *   - consecutiveFailures + lowQualityRatio (the auto-pause signals)
 *   - completedItems / rejectedItems / discoveredItems (lifetime
 *     volume vs noise)
 *   - lastSuccessfulSync / lastFailedSync / lastContentUpdateAt
 *   - recentRejected — count of RejectedContentLog rows from this
 *     host in the last 7 days, with failure-category breakdown
 *
 * Read-only and admin-gated. Backs the
 * /api/admin/content-qa/source-audit endpoint.
 */

import { prisma } from "../db/client";

export type SourceAuditResult = {
  found: boolean;
  source?: {
    id: string;
    name: string;
    host: string;
    tier: number | null;
    trustLabel: string | null;
    isOfficial: boolean;
    healthState: string;
    pausedAt: Date | null;
    pausedReason: string | null;
    autoPaused: boolean;
    autoPausedAt: Date | null;
    consecutiveFailures: number;
    lowQualityRatio: number | null;
    completedItems: number;
    rejectedItems: number;
    discoveredItems: number;
    lastSuccessfulSync: Date | null;
    lastFailedSync: Date | null;
    lastContentUpdateAt: Date | null;
    exhaustedAt: Date | null;
  };
  recentRejected: {
    last7d: number;
    byFailureCategory: Record<string, number>;
    byContentType: Record<string, number>;
  };
  trustExplanation: string;
};

function buildTrustExplanation(args: {
  tier: number | null;
  isOfficial: boolean;
  healthState: string;
  pausedAt: Date | null;
  pausedReason: string | null;
  autoPaused: boolean;
  lowQualityRatio: number | null;
}): string {
  const parts: string[] = [];
  if (args.isOfficial) parts.push("Official Catholic source");
  if (args.tier === 1) parts.push("Tier 1 (official Church publisher)");
  if (args.tier === 2) parts.push("Tier 2 (established Catholic publisher)");
  if (args.tier === 3) parts.push("Tier 3 (general / news)");
  if (args.pausedAt) {
    parts.push(
      `PAUSED ${args.autoPaused ? "(auto)" : "(manual)"}: ${
        args.pausedReason ?? "no reason given"
      }`,
    );
  } else if (args.healthState === "failing") {
    parts.push("Currently failing — auto-pause may follow");
  } else if (args.healthState === "blocked") {
    parts.push("Blocked by robots.txt or upstream policy");
  } else if (args.healthState === "exhausted") {
    parts.push("Exhausted — every known item has been ingested");
  } else {
    parts.push("Active and healthy");
  }
  if (args.lowQualityRatio !== null && args.lowQualityRatio >= 0.5) {
    parts.push(`Quality concern: ${(args.lowQualityRatio * 100).toFixed(0)}% low-quality ratio`);
  }
  return parts.join(" · ");
}

export async function getSourceAudit(args: { sourceIdOrHost: string }): Promise<SourceAuditResult> {
  let source = null;
  try {
    source = await prisma.ingestionSource.findUnique({
      where: { id: args.sourceIdOrHost },
    });
    if (!source) {
      source = await prisma.ingestionSource.findUnique({
        where: { host: args.sourceIdOrHost },
      });
    }
  } catch {
    // best-effort
  }

  // Rejection history over the last 7 days, scoped to this host.
  const recent: SourceAuditResult["recentRejected"] = {
    last7d: 0,
    byFailureCategory: {},
    byContentType: {},
  };
  if (source) {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const rows = await prisma.rejectedContentLog.findMany({
        where: { sourceHost: source.host, deletedAt: { gte: since } },
        select: { contentType: true, failureCategory: true },
        take: 1000,
      });
      recent.last7d = rows.length;
      for (const row of rows) {
        const cat = row.failureCategory ?? "unknown";
        recent.byFailureCategory[cat] = (recent.byFailureCategory[cat] ?? 0) + 1;
        recent.byContentType[row.contentType] = (recent.byContentType[row.contentType] ?? 0) + 1;
      }
    } catch {
      // best-effort
    }
  }

  if (!source) {
    return {
      found: false,
      recentRejected: recent,
      trustExplanation: "No matching source registered.",
    };
  }

  return {
    found: true,
    source: {
      id: source.id,
      name: source.name,
      host: source.host,
      tier: source.tier,
      trustLabel: source.trustLabel,
      isOfficial: source.isOfficial,
      healthState: source.healthState,
      pausedAt: source.pausedAt,
      pausedReason: source.pausedReason,
      autoPaused: source.autoPaused,
      autoPausedAt: source.autoPausedAt,
      consecutiveFailures: source.consecutiveFailures,
      lowQualityRatio: source.lowQualityRatio,
      completedItems: source.completedItems,
      rejectedItems: source.rejectedItems,
      discoveredItems: source.discoveredItems,
      lastSuccessfulSync: source.lastSuccessfulSync,
      lastFailedSync: source.lastFailedSync,
      lastContentUpdateAt: source.lastContentUpdateAt,
      exhaustedAt: source.exhaustedAt,
    },
    recentRejected: recent,
    trustExplanation: buildTrustExplanation({
      tier: source.tier,
      isOfficial: source.isOfficial,
      healthState: source.healthState,
      pausedAt: source.pausedAt,
      pausedReason: source.pausedReason,
      autoPaused: source.autoPaused,
      lowQualityRatio: source.lowQualityRatio,
    }),
  };
}
