/**
 * Web navigator. Discovers candidate URLs from sources the admin has
 * already approved.
 *
 * Web access policy (decided during planning):
 *   - Only approved authority hosts may be fetched. The Admin Worker
 *     extends discovery within those hosts via sitemaps, RSS feeds,
 *     configured fixed URL lists, and internal links. New hosts
 *     require admin approval — there is no open-internet crawl.
 *   - Junk URL patterns (livestreams, events, donations, staff pages,
 *     bulletins, school pages, news posts, calendars, login, store, ads)
 *     are filtered before fetch.
 *
 * This module owns the URL store + junk-URL classifier. Live sitemap,
 * RSS, internal-link, configured-URL, directory, and search-page
 * discovery live in their own modules (`*-discovery.ts`); they call
 * `discoverFromHost` to persist the candidates they find.
 */

import type {
  CandidateSourceDiscoveryMethod,
  CandidateSourceUrlStatus,
  PrismaClient,
} from "@prisma/client";

import { isApprovedAuthorityHost } from "@/lib/worker";

export class UnapprovedHostError extends Error {
  constructor(host: string) {
    super(`Host ${host} is not on the approved authority list.`);
    this.name = "UnapprovedHostError";
  }
}

/**
 * Junk URL patterns. The classifier rejects URLs matching any pattern
 * before insertion — these URLs are unlikely to contain complete
 * content packages and would waste fetch attempts.
 */
const JUNK_PATTERNS: ReadonlyArray<RegExp> = [
  /\/(live|livestream|stream|watch)(\/|$|\?)/i,
  /\/(events?|calendar)(\/|$|\?)/i,
  /\/(donate|give|giving|donation)(\/|$|\?)/i,
  /\/(staff|directory)(\/|$|\?)/i,
  /\/(bulletin|newsletter)(\/|$|\?)/i,
  /\/(school)(\/|$|\?)/i,
  /\/(news|press|blog)\/[^/]+\/?$/i,
  /\/(login|signin|register|account)(\/|$|\?)/i,
  /\/(shop|store|cart|checkout|gift-shop|bookstore)(\/|$|\?)/i,
  /\/(ad|ads|advert|sponsor|sponsored)(\/|$|\?)/i,
];

export function isJunkUrl(url: string): { junk: boolean; reason?: string } {
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(url)) {
      return { junk: true, reason: `matched junk pattern ${pattern.source}` };
    }
  }
  return { junk: false };
}

export interface DiscoverCandidateInput {
  url: string;
  sourceHost: string;
  sourceId?: string;
  discoveryMethod: CandidateSourceDiscoveryMethod;
  predictedContentType?: string;
  predictedUsefulness?: number;
}

/**
 * Insert a candidate URL after host-allowlist + junk-pattern checks.
 * Returns `null` when the URL was rejected (callers should treat this
 * as expected, not an error — the navigator constantly filters noise).
 */
export async function discoverCandidate(
  prisma: PrismaClient,
  input: DiscoverCandidateInput,
): Promise<{ id: string; status: CandidateSourceUrlStatus } | null> {
  let host = input.sourceHost;
  try {
    host = new URL(input.url).host;
  } catch {
    return null;
  }
  if (!isApprovedAuthorityHost(host)) {
    return null;
  }
  const junk = isJunkUrl(input.url);
  if (junk.junk) {
    await prisma.candidateSourceUrl.upsert({
      where: { discoveredUrl: input.url },
      create: {
        discoveredUrl: input.url,
        sourceHost: host,
        sourceId: input.sourceId,
        discoveryMethod: input.discoveryMethod,
        predictedContentType: input.predictedContentType,
        predictedUsefulness: 0,
        status: "REJECTED",
        rejectionReason: junk.reason,
      },
      update: {
        status: "REJECTED",
        rejectionReason: junk.reason,
      },
    });
    return null;
  }

  const row = await prisma.candidateSourceUrl.upsert({
    where: { discoveredUrl: input.url },
    create: {
      discoveredUrl: input.url,
      sourceHost: host,
      sourceId: input.sourceId,
      discoveryMethod: input.discoveryMethod,
      predictedContentType: input.predictedContentType,
      predictedUsefulness: input.predictedUsefulness ?? 0.5,
      status: "DISCOVERED",
    },
    update: {
      predictedContentType: input.predictedContentType,
      predictedUsefulness: input.predictedUsefulness ?? undefined,
    },
    select: { id: true, status: true },
  });
  return row;
}

export async function nextCandidatesForFetch(prisma: PrismaClient, limit = 25) {
  return prisma.candidateSourceUrl.findMany({
    where: { status: { in: ["DISCOVERED", "PRIORITIZED"] } },
    orderBy: [{ predictedUsefulness: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
}
