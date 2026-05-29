/**
 * Content growth execution monitor (spec §17).
 *
 * Computes the full per-content-type funnel — every stage from
 * candidate discovery through public/search/sitemap visibility — by
 * querying the durable tables. This is the "is content actually
 * flowing through the whole chain, per content type?" view the
 * command center, content-growth dashboard, and Developer Audit use.
 *
 * Each row answers, for one content type: how many candidates were
 * discovered, prioritized, fetched, read, parsed into blocks, built
 * into artifacts, bridged to checklist items + citations, verified,
 * passed strict QA, passed quality scoring, published, and verified
 * post-publish — plus whether the public tab / search / sitemap show
 * the content.
 */

import type { PrismaClient } from "@prisma/client";

export interface ContentFunnelRow {
  contentType: string;
  candidatesDiscovered: number;
  candidatesPrioritized: number;
  sourcesFetched: number;
  sourceReadsCreated: number;
  structuredBlocksCreated: number;
  packageArtifactsCreated: number;
  checklistItemsCreated: number;
  citationsCreated: number;
  validationPasses: number;
  strictQAPasses: number;
  qualityScorePasses: number;
  publishedItems: number;
  postPublishPasses: number;
  publicTabVisible: boolean;
  searchVisible: boolean;
  sitemapVisible: boolean;
  /** The first funnel stage with a zero count downstream of a non-zero one. */
  firstEmptyStage: string | null;
}

/**
 * Compute the funnel for one content type. Best-effort: each query
 * degrades to 0 so a missing table never breaks the monitor.
 */
async function funnelFor(prisma: PrismaClient, contentType: string): Promise<ContentFunnelRow> {
  const ct = contentType;
  const ctEnum = ct as never;

  const [
    candidatesDiscovered,
    candidatesPrioritized,
    sourcesFetched,
    sourceReadsCreated,
    packageArtifactsCreated,
    checklistItemsCreated,
    validationPasses,
    strictQAPasses,
    qualityScorePasses,
    publishedItems,
    postPublishPasses,
  ] = await Promise.all([
    prisma.candidateSourceUrl.count({ where: { predictedContentType: ct } }).catch(() => 0),
    prisma.candidateSourceUrl
      .count({ where: { predictedContentType: ct, status: "PRIORITIZED" } })
      .catch(() => 0),
    prisma.candidateSourceUrl
      .count({ where: { predictedContentType: ct, status: { in: ["FETCHED", "BUILT"] } } })
      .catch(() => 0),
    prisma.adminWorkerSourceRead.count({ where: { detectedContentType: ct } }).catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { contentType: ct } }).catch(() => 0),
    prisma.checklistItem.count({ where: { contentType: ctEnum } }).catch(() => 0),
    prisma.adminWorkerCrossSourceVerification
      .count({ where: { contentType: ct, matchResult: { in: ["MATCH", "PASS"] } } })
      .catch(() => 0),
    prisma.adminWorkerStrictQAResult
      .count({ where: { contentType: ct, status: "PASSED" } })
      .catch(() => 0),
    prisma.contentQualityScore
      .count({ where: { contentType: ct, finalScore: { gte: 0.8 } } })
      .catch(() => 0),
    prisma.publishedContent
      .count({ where: { contentType: ctEnum, isPublished: true } })
      .catch(() => 0),
    prisma.postPublishVerification
      .count({ where: { contentType: ct, result: "PASS" } })
      .catch(() => 0),
  ]);

  // Structured blocks + citations are linked indirectly; count via the
  // owning rows for this content type, best-effort.
  const structuredBlocksCreated = await prisma.adminWorkerSourceBlock
    .count({ where: { sourceRead: { detectedContentType: ct } } } as never)
    .catch(() => 0);
  const citationsCreated = await prisma.checklistCitation
    .count({ where: { checklistItem: { contentType: ctEnum } } } as never)
    .catch(() => 0);

  // Public-surface visibility signals.
  const publicTabVisible = publishedItems > 0;
  const searchVisible = publishedItems > 0; // search reads from PublishedContent
  const sitemapVisible = publishedItems > 0; // sitemap reads from PublishedContent

  // Identify the first stage that drops to zero while an upstream
  // stage produced output — the funnel bottleneck.
  const stages: Array<[string, number]> = [
    ["candidatesDiscovered", candidatesDiscovered],
    ["candidatesPrioritized", candidatesPrioritized],
    ["sourcesFetched", sourcesFetched],
    ["sourceReadsCreated", sourceReadsCreated],
    ["structuredBlocksCreated", structuredBlocksCreated],
    ["packageArtifactsCreated", packageArtifactsCreated],
    ["checklistItemsCreated", checklistItemsCreated],
    ["validationPasses", validationPasses],
    ["strictQAPasses", strictQAPasses],
    ["qualityScorePasses", qualityScorePasses],
    ["publishedItems", publishedItems],
    ["postPublishPasses", postPublishPasses],
  ];
  let firstEmptyStage: string | null = null;
  let sawUpstream = false;
  for (const [name, count] of stages) {
    if (count > 0) {
      sawUpstream = true;
      continue;
    }
    if (sawUpstream) {
      firstEmptyStage = name;
      break;
    }
  }

  return {
    contentType: ct,
    candidatesDiscovered,
    candidatesPrioritized,
    sourcesFetched,
    sourceReadsCreated,
    structuredBlocksCreated,
    packageArtifactsCreated,
    checklistItemsCreated,
    citationsCreated,
    validationPasses,
    strictQAPasses,
    qualityScorePasses,
    publishedItems,
    postPublishPasses,
    publicTabVisible,
    searchVisible,
    sitemapVisible,
    firstEmptyStage,
  };
}

/**
 * Compute the full funnel for every content type with a content goal.
 */
export async function computeContentFunnel(prisma: PrismaClient): Promise<ContentFunnelRow[]> {
  const goals = await prisma.contentGoal
    .findMany({ orderBy: [{ priority: "asc" }], select: { contentType: true } })
    .catch(() => [] as Array<{ contentType: string }>);
  const rows: ContentFunnelRow[] = [];
  for (const g of goals) {
    rows.push(await funnelFor(prisma, g.contentType));
  }
  return rows;
}
