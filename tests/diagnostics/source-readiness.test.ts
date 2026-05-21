/**
 * Source readiness summary.
 *
 * Pins section 19: total / factory-ready / with-jobs / zero-jobs /
 * discovery-method / paused / unhealthy / not-configured source
 * counts, plus per-content-type source coverage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/sources/source-plan", () => ({
  buildSourcePlanReport: vi.fn().mockResolvedValue({
    rows: [
      {
        contentType: "Prayer",
        required: 3,
        configured: 2,
        factoryReady: 1,
        validationSources: 1,
        enrichmentSources: 0,
        shortfall: 2,
        status: "warn",
        sourceHealth: "healthy",
        nextAutomaticRepairAction: "",
      },
    ],
    worst: "warn",
    underMinimum: 1,
    zeroFactoryReady: 0,
    generatedAt: new Date(),
  }),
}));

import { getSourceReadinessSummary } from "@/lib/diagnostics/source-readiness";

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "s",
    isActive: true,
    pausedAt: null,
    discoveryMethod: "sitemap",
    configurationStatus: "factory_native",
    healthState: "active",
    role: "primary_content_source",
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
});

describe("getSourceReadinessSummary", () => {
  it("aggregates source-level readiness counts", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      source({ id: "s1" }),
      source({ id: "s2", pausedAt: new Date(), discoveryMethod: "rss" }),
      source({
        id: "s3",
        discoveryMethod: null,
        configurationStatus: "not_configured",
        healthState: "failing",
      }),
    ]);
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([{ sourceId: "s1" }]);
    prismaMock.sourceDocument.groupBy.mockResolvedValue([{ sourceId: "s1" }, { sourceId: "s2" }]);

    const summary = await getSourceReadinessSummary();

    expect(summary.totalSources).toBe(3);
    expect(summary.factoryReadySources).toBe(1); // s1 only — s2 paused, s3 has no method
    expect(summary.sourcesWithJobs).toBe(1);
    expect(summary.sourcesWithZeroJobs).toBe(0); // the one factory-ready source has a job
    expect(summary.sourcesWithDiscoveryMethod).toBe(2);
    expect(summary.sourcesWithoutDiscoveryMethod).toBe(1);
    expect(summary.pausedSources).toBe(1);
    expect(summary.unhealthySources).toBe(1);
    expect(summary.notConfiguredSources).toBe(1);
    expect(summary.sourcesThatProducedDocuments).toBe(2);
  });

  it("surfaces sources with zero jobs among factory-ready sources", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      source({ id: "s1" }),
      source({ id: "s2" }),
    ]);
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]); // no source has a job
    prismaMock.sourceDocument.groupBy.mockResolvedValue([]);

    const summary = await getSourceReadinessSummary();

    expect(summary.factoryReadySources).toBe(2);
    expect(summary.sourcesWithZeroJobs).toBe(2);
  });

  it("includes per-content-type source coverage", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
    prismaMock.sourceDocument.groupBy.mockResolvedValue([]);

    const summary = await getSourceReadinessSummary();

    expect(summary.contentTypeCoverage).toHaveLength(1);
    expect(summary.contentTypeCoverage[0]).toMatchObject({
      contentType: "Prayer",
      required: 3,
      factoryReady: 1,
      shortfall: 2,
    });
  });
});
