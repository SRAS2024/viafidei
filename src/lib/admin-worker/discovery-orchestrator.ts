/**
 * DiscoveryOrchestrator (spec §4). Pulls together the six existing
 * discovery modules — sitemap, RSS, configured URL, directory,
 * internal link, search page (and source API where available) — and
 * runs them under one policy:
 *
 *   - Run discovery when a content goal is below threshold
 *   - Run more often for content types with no recent growth
 *   - Run less often for content types already at goal
 *   - Rank approved sources before scanning them (TRUSTED first)
 *   - Avoid repeated scanning of unproductive sources
 *   - Record every skipped source with a reason
 *   - Record every rejected URL with a reason (handled by
 *     candidate-scorer.ts + web-navigator.ts)
 *   - Never crawl unapproved hosts (enforced by web-navigator.ts)
 *
 * Content-type-specific strategies bias the discovery target. They
 * are stored as URL-pattern hints that the candidate scorer uses to
 * compute contentTypeLikelihood; this file just decides WHICH
 * discoverers to run and HOW OFTEN.
 */

import type { PrismaClient } from "@prisma/client";

import { rescoreAllCandidates } from "./candidate-scorer";
import { discoverFromConfiguredUrls } from "./configured-urls";
import { discoverFromDirectories } from "./directory-discovery";
import { writeAdminWorkerLog } from "./logs";
import { discoverFromHost } from "./sitemap-discovery";

/**
 * Per-content-type discovery strategy. The `hints` field is a list
 * of URL substrings the orchestrator prefers when ranking which
 * sources to fetch for this type; the candidate scorer also uses
 * these to assess contentTypeLikelihood.
 */
export interface ContentTypeStrategy {
  contentType: string;
  hints: string[];
  preferDiscoverers: Array<
    "SITEMAP" | "RSS" | "CONFIGURED" | "DIRECTORY" | "INTERNAL_LINK" | "SEARCH" | "API"
  >;
  description: string;
}

export const CONTENT_TYPE_STRATEGIES: Record<string, ContentTypeStrategy> = {
  PRAYER: {
    contentType: "PRAYER",
    hints: ["/prayers/", "/prayer/", "/novena", "/chaplet", "/litany", "act-of-"],
    preferDiscoverers: ["CONFIGURED", "SITEMAP", "INTERNAL_LINK", "SEARCH"],
    description:
      "Prefer pages likely to contain the actual prayer text — avoid articles ABOUT prayers.",
  },
  SAINT: {
    contentType: "SAINT",
    hints: ["/saint/", "/saints/", "/santo/", "/feast-day/", "/biograph"],
    preferDiscoverers: ["DIRECTORY", "SITEMAP", "CONFIGURED", "INTERNAL_LINK"],
    description: "Prioritize biography + feast-day pages, not saint-named schools or parishes.",
  },
  APPARITION: {
    contentType: "APPARITION",
    hints: ["/apparition", "/our-lady-of-", "/marian-"],
    preferDiscoverers: ["CONFIGURED", "SITEMAP"],
    description: "Prioritize approval-status pages and Vatican statements.",
  },
  NOVENA: {
    contentType: "NOVENA",
    hints: ["/novena", "/9-day", "/nine-day", "day-1", "day-9"],
    preferDiscoverers: ["CONFIGURED", "SITEMAP", "INTERNAL_LINK"],
    description: "Prioritize pages with explicit day sections.",
  },
  DEVOTION: {
    contentType: "DEVOTION",
    hints: ["/devotion", "/spiritual-practice", "how-to"],
    preferDiscoverers: ["CONFIGURED", "INTERNAL_LINK"],
    description: "Prioritize pages with practice instructions.",
  },
  ROSARY: {
    contentType: "ROSARY",
    hints: ["/rosary", "/mysteries", "/how-to-pray-the-rosary"],
    preferDiscoverers: ["CONFIGURED", "SITEMAP"],
    description: "Prioritize pages with mystery sets and prayer order.",
  },
  SACRAMENT: {
    contentType: "SACRAMENT",
    hints: ["/sacrament", "/catechism", "/baptism", "/eucharist", "/confession"],
    preferDiscoverers: ["CONFIGURED", "SITEMAP"],
    description: "Prioritize official catechetical pages.",
  },
  CHURCH_DOCUMENT: {
    contentType: "CHURCH_DOCUMENT",
    hints: ["/encyclical", "/council", "/canon-law", "/catechism", "/papal"],
    preferDiscoverers: ["CONFIGURED", "SITEMAP", "API"],
    description: "Prioritize official Church documents, councils, catechisms, canon law.",
  },
  LITURGICAL: {
    contentType: "LITURGICAL",
    hints: ["/liturg", "/order-of-mass", "/calendar/liturgical"],
    preferDiscoverers: ["CONFIGURED", "SITEMAP"],
    description: "Prioritize liturgical formation, not news or homilies.",
  },
  PARISH: {
    contentType: "PARISH",
    hints: ["/parish", "/dioces", "/find-a-parish", "/contact-us", "/address"],
    preferDiscoverers: ["DIRECTORY", "CONFIGURED"],
    description: "Prioritize actual parish directory records.",
  },
};

export interface DiscoveryOrchestrationOutcome {
  /** Total candidate URLs surfaced by this pass. */
  surfaced: number;
  /** Candidates skipped because their score was below threshold. */
  rejected: number;
  /** Hosts skipped this pass (with reasons). */
  hostsSkipped: Array<{ host: string; reason: string }>;
  /** Strategies that fired in this pass. */
  strategies: string[];
  errors: string[];
}

/**
 * Run a discovery pass for the highest-priority content type with a
 * gap. Picks discoverers based on the strategy; ranks approved hosts
 * before fetching them; rescores candidates at the end so the
 * fetcher reads from the best-priority pile next.
 */
export async function runDiscoveryOrchestrator(
  prisma: PrismaClient,
  opts: { passId?: string; contentType?: string | null } = {},
): Promise<DiscoveryOrchestrationOutcome> {
  const errors: string[] = [];
  const strategies: string[] = [];
  const hostsSkipped: Array<{ host: string; reason: string }> = [];

  // Determine which content type to target. Prefer the explicit
  // request, otherwise pick the goal with the biggest gap.
  let contentType = opts.contentType ?? null;
  if (!contentType) {
    const nextGoal = await prisma.contentGoal
      .findFirst({
        where: { gapCount: { gt: 0 } },
        orderBy: [{ gapCount: "desc" }, { priority: "asc" }],
      })
      .catch(() => null);
    contentType = nextGoal?.contentType ?? null;
  }

  const strategy = contentType ? CONTENT_TYPE_STRATEGIES[contentType] : null;
  if (strategy) strategies.push(strategy.description);

  // Rank approved hosts by reputation. Hosts that are PAUSED or have
  // a low fetch success rate get skipped this pass — they go on a
  // slow re-test schedule (handled by the source-reputation module).
  const rankedHosts = await prisma.adminWorkerSourceReputation
    .findMany({
      where: { paused: false },
      orderBy: [
        { reputationTier: "asc" }, // enum order puts TRUSTED first
        { contentBuildSuccessRate: "desc" },
        { fetchSuccessRate: "desc" },
      ],
      take: 20,
      select: { sourceHost: true, fetchSuccessRate: true, reputationTier: true },
    })
    .catch(
      () => [] as Array<{ sourceHost: string; fetchSuccessRate: number; reputationTier: string }>,
    );

  let surfaced = 0;

  // Sitemap discovery for each top host. We skip hosts whose recent
  // fetch success rate is too low ("unproductive sources").
  if (!strategy || strategy.preferDiscoverers.includes("SITEMAP")) {
    for (const host of rankedHosts) {
      if (host.fetchSuccessRate < 0.2 && host.reputationTier !== "NEUTRAL") {
        hostsSkipped.push({
          host: host.sourceHost,
          reason: `fetch success rate ${host.fetchSuccessRate.toFixed(2)} too low`,
        });
        continue;
      }
      try {
        const outcome = await discoverFromHost(prisma, host.sourceHost);
        surfaced += outcome.inserted;
        // Spec §19: source reputation updates after the discovery stage
        // — a host that surfaces candidates is more productive.
        const { pushReputation } = await import("./source-reputation-hooks");
        await pushReputation(prisma, {
          sourceHost: host.sourceHost,
          contentType: contentType ?? undefined,
          stage: "discovery",
          ok: outcome.inserted > 0,
        }).catch(() => undefined);
      } catch (e) {
        errors.push(`sitemap:${host.sourceHost}: ${(e as Error).message}`);
      }
    }
  }

  // Configured URL discovery — always runs because configured URLs
  // are explicit operator-curated entries.
  if (!strategy || strategy.preferDiscoverers.includes("CONFIGURED")) {
    try {
      const outcome = await discoverFromConfiguredUrls(prisma);
      surfaced += outcome.inserted;
    } catch (e) {
      errors.push(`configured: ${(e as Error).message}`);
    }
  }

  // Directory discovery for content types whose strategy asks for it.
  if (strategy?.preferDiscoverers.includes("DIRECTORY")) {
    try {
      const outcome = await discoverFromDirectories(prisma);
      surfaced += outcome.inserted;
    } catch (e) {
      errors.push(`directory: ${(e as Error).message}`);
    }
  }

  // RSS discovery (spec §4) — probe /feed on each approved host.
  // Hosts without a feed get a recorded skip reason.
  if (!strategy || strategy.preferDiscoverers.includes("RSS")) {
    try {
      const { discoverFromFeed } = await import("./rss-discovery");
      for (const host of rankedHosts.slice(0, 5)) {
        const r = await discoverFromFeed(prisma, `https://${host.sourceHost}/feed`).catch(
          () => null,
        );
        if (r?.fetched) surfaced += r.inserted;
        else if (r?.reason) {
          hostsSkipped.push({ host: host.sourceHost, reason: `rss: ${r.reason}` });
        }
      }
    } catch (e) {
      errors.push(`rss: ${(e as Error).message}`);
    }
  }

  // Internal-link discovery (spec §4) — expand from already-known
  // good URLs to find related content on the same host.
  if (!strategy || strategy.preferDiscoverers.includes("INTERNAL_LINK")) {
    try {
      const { discoverFromInternalLinks } = await import("./internal-link-discovery");
      const seeds = await prisma.adminWorkerSourceRead
        .findMany({
          where: { detectedContentType: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { sourceUrl: true },
        })
        .catch(() => [] as Array<{ sourceUrl: string }>);
      for (const seed of seeds) {
        const r = await discoverFromInternalLinks(prisma, seed.sourceUrl).catch(() => null);
        if (r?.fetched) surfaced += r.inserted;
      }
    } catch (e) {
      errors.push(`internal_link: ${(e as Error).message}`);
    }
  }

  // Approved-source search-page discovery (spec §4).
  if (!strategy || strategy.preferDiscoverers.includes("SEARCH")) {
    try {
      const { discoverFromSearchPages } = await import("./search-page-discovery");
      // Use the strategy's first hint as a search query when available.
      const query = strategy?.hints[0] ?? contentType ?? "catholic";
      const r = await discoverFromSearchPages(prisma, query);
      surfaced += r.inserted;
    } catch (e) {
      errors.push(`search: ${(e as Error).message}`);
    }
  }

  // Official API discovery (spec §4) — only fires when an adapter is
  // registered. Adapter list is empty by default; this is a no-op
  // safe stub.
  if (!strategy || strategy.preferDiscoverers.includes("API")) {
    try {
      const { discoverFromApis } = await import("./source-apis");
      const r = await discoverFromApis(prisma);
      surfaced += r.inserted;
    } catch (e) {
      errors.push(`api: ${(e as Error).message}`);
    }
  }

  // Score every newly-discovered candidate so the fetcher can pick
  // the best ones first on the next pass.
  const rescored = await rescoreAllCandidates(prisma, { limit: 200 });

  await writeAdminWorkerLog(prisma, {
    passId: opts.passId ?? null,
    category: "SOURCE_DISCOVERY",
    severity: surfaced > 0 ? "INFO" : "WARN",
    eventName: "discovery_orchestrator",
    message: `Discovery orchestrator surfaced ${surfaced} for ${contentType ?? "any type"}; ${hostsSkipped.length} host(s) skipped; ${rescored.rejected} rejected by scorer; ${rescored.prioritized} prioritized.`,
    contentType: contentType ?? undefined,
    safeMetadata: {
      strategy: strategy?.description,
      surfaced,
      rejectedByScorer: rescored.rejected,
      prioritized: rescored.prioritized,
      hostsSkipped: hostsSkipped.map((h) => h.host),
      errors,
    },
  });

  return {
    surfaced,
    rejected: rescored.rejected,
    hostsSkipped,
    strategies,
    errors,
  };
}

/**
 * Decide how often each content type should run discovery. The
 * answer is encoded as a "minutes between passes" target the brain
 * can compare against the last-discovery timestamp.
 *
 * Spec §4:
 *   "Discovery should run whenever a content goal is below threshold.
 *    Discovery should run more often for content types with no growth.
 *    Discovery should run less often for content types that already
 *    reached their goal."
 */
export function discoveryCadenceMinutes(opts: {
  gapCount: number;
  hoursSinceLastGrowth: number | null;
  hasGoalReached: boolean;
}): number {
  if (opts.hasGoalReached) return 12 * 60; // 12h cadence in maintenance
  if (opts.gapCount === 0) return 12 * 60;
  if (opts.hoursSinceLastGrowth == null || opts.hoursSinceLastGrowth >= 7 * 24) {
    return 30; // never published or > 7d stale — fastest cadence
  }
  if (opts.hoursSinceLastGrowth >= 24) return 60;
  if (opts.hoursSinceLastGrowth >= 6) return 2 * 60;
  return 4 * 60;
}
