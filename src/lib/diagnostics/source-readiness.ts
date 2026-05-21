/**
 * Source readiness summary.
 *
 * One report covering "do we have enough sources, are they
 * configured, and are they actually producing work?" — the source
 * side of the content factory. Pairs the per-content-type source
 * plan with live job + document counts.
 */

import { prisma } from "../db/client";
import { buildSourcePlanReport } from "../ingestion/sources/source-plan";

const ACTIVE_QUEUE_STATUSES = ["pending", "retrying", "running"];
const VALID_DISCOVERY_METHODS = [
  "sitemap",
  "rss",
  "fixed_url_list",
  "official_api",
  "factory_handler",
];

export type ContentTypeSourceCoverage = {
  contentType: string;
  required: number;
  configured: number;
  factoryReady: number;
  validationSources: number;
  enrichmentSources: number;
  shortfall: number;
};

export type SourceReadinessSummary = {
  generatedAt: Date;
  totalSources: number;
  factoryReadySources: number;
  sourcesWithJobs: number;
  sourcesWithZeroJobs: number;
  sourcesWithDiscoveryMethod: number;
  sourcesWithoutDiscoveryMethod: number;
  pausedSources: number;
  unhealthySources: number;
  notConfiguredSources: number;
  sourcesThatProducedDocuments: number;
  contentTypeCoverage: ContentTypeSourceCoverage[];
  errors: string[];
};

type SourceRow = {
  id: string;
  isActive: boolean;
  pausedAt: Date | null;
  discoveryMethod: string | null;
  configurationStatus: string | null;
  healthState: string;
  role: string;
};

function isFactoryReady(s: SourceRow): boolean {
  return (
    s.isActive &&
    !s.pausedAt &&
    s.role !== "rejected_source" &&
    !!s.discoveryMethod &&
    VALID_DISCOVERY_METHODS.includes(s.discoveryMethod)
  );
}

export async function getSourceReadinessSummary(): Promise<SourceReadinessSummary> {
  const errors: string[] = [];
  const generatedAt = new Date();

  let sources: SourceRow[] = [];
  try {
    sources = await prisma.ingestionSource.findMany({
      select: {
        id: true,
        isActive: true,
        pausedAt: true,
        discoveryMethod: true,
        configurationStatus: true,
        healthState: true,
        role: true,
      },
      take: 2000,
    });
  } catch (e) {
    errors.push(`source read: ${e instanceof Error ? e.message : String(e)}`);
  }

  let sourcesWithActiveJobs = new Set<string>();
  try {
    const groups = await prisma.ingestionJobQueue.groupBy({
      by: ["sourceId"],
      where: { status: { in: ACTIVE_QUEUE_STATUSES }, sourceId: { not: null } },
    });
    sourcesWithActiveJobs = new Set(
      groups.map((g) => g.sourceId).filter((id): id is string => typeof id === "string"),
    );
  } catch (e) {
    errors.push(`job groupBy: ${e instanceof Error ? e.message : String(e)}`);
  }

  let sourcesThatProducedDocuments = 0;
  try {
    const docGroups = await prisma.sourceDocument.groupBy({
      by: ["sourceId"],
      where: { sourceId: { not: null } },
    });
    sourcesThatProducedDocuments = docGroups.length;
  } catch (e) {
    errors.push(`document groupBy: ${e instanceof Error ? e.message : String(e)}`);
  }

  let contentTypeCoverage: ContentTypeSourceCoverage[] = [];
  try {
    const plan = await buildSourcePlanReport();
    contentTypeCoverage = plan.rows.map((r) => ({
      contentType: r.contentType,
      required: r.required,
      configured: r.configured,
      factoryReady: r.factoryReady,
      validationSources: r.validationSources,
      enrichmentSources: r.enrichmentSources,
      shortfall: r.shortfall,
    }));
  } catch (e) {
    errors.push(`source plan: ${e instanceof Error ? e.message : String(e)}`);
  }

  const factoryReadyList = sources.filter(isFactoryReady);
  const withMethod = sources.filter(
    (s) => !!s.discoveryMethod && VALID_DISCOVERY_METHODS.includes(s.discoveryMethod),
  );

  return {
    generatedAt,
    totalSources: sources.length,
    factoryReadySources: factoryReadyList.length,
    sourcesWithJobs: sources.filter((s) => sourcesWithActiveJobs.has(s.id)).length,
    sourcesWithZeroJobs: factoryReadyList.filter((s) => !sourcesWithActiveJobs.has(s.id)).length,
    sourcesWithDiscoveryMethod: withMethod.length,
    sourcesWithoutDiscoveryMethod: sources.length - withMethod.length,
    pausedSources: sources.filter((s) => s.pausedAt !== null).length,
    unhealthySources: sources.filter(
      (s) => s.healthState === "failing" || s.healthState === "blocked",
    ).length,
    notConfiguredSources: sources.filter((s) => s.configurationStatus === "not_configured").length,
    sourcesThatProducedDocuments,
    contentTypeCoverage,
    errors,
  };
}
