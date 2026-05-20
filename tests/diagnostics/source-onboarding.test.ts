/**
 * Source onboarding diagnostics.
 *
 * Proves:
 *   1. A factory-ready primary source is verdict "ready"; a
 *      discovery-only source is "incomplete"; a rejected / inactive
 *      source is "blocked".
 *   2. Every onboarding facet (discovery method, role, tier, content
 *      types, caps, health) is reported per source.
 *   3. A content type with a validation source but no primary raises
 *      the validation_without_primary warning.
 *   4. A factory-ready source with no successful builds raises the
 *      sources_without_builds warning.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getSourceOnboardingReport } from "@/lib/diagnostics/source-onboarding";

function source(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "id",
    name: "A Source",
    host: "host.example",
    isActive: true,
    isOfficial: false,
    trustLabel: null,
    tier: 3,
    role: "discovery_only_source",
    healthState: "active",
    autoPaused: false,
    pausedAt: null,
    discoveryMethod: null,
    fetchLimitPerRun: null,
    buildLimitPerRun: null,
    dailyCap: null,
    canIngestPrayers: false,
    canIngestSaints: false,
    canIngestApparitions: false,
    canIngestParishes: false,
    canIngestDevotions: false,
    canIngestNovenas: false,
    canIngestSacraments: false,
    canIngestRosaryGuides: false,
    canIngestConsecrations: false,
    canIngestSpiritualGuides: false,
    canIngestLiturgy: false,
    canIngestHistory: false,
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
});

describe("getSourceOnboardingReport", () => {
  it("classifies the onboarding verdict per source", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      source({
        id: "ready1",
        host: "ready.example",
        role: "primary_content_source",
        discoveryMethod: "sitemap",
        canIngestPrayers: true,
      }),
      source({
        id: "inc1",
        host: "inc.example",
        role: "discovery_only_source",
        discoveryMethod: "sitemap",
        canIngestSaints: true,
      }),
      source({
        id: "blk1",
        host: "blk.example",
        role: "rejected_source",
        discoveryMethod: "sitemap",
        canIngestPrayers: true,
      }),
    ]);
    const report = await getSourceOnboardingReport();
    expect(report.sources.find((s) => s.host === "ready.example")?.verdict).toBe("ready");
    expect(report.sources.find((s) => s.host === "inc.example")?.verdict).toBe("incomplete");
    expect(report.sources.find((s) => s.host === "blk.example")?.verdict).toBe("blocked");
  });

  it("reports every onboarding facet per source", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      source({
        id: "s1",
        host: "vatican.va",
        role: "primary_content_source",
        tier: 1,
        isOfficial: true,
        discoveryMethod: "sitemap",
        fetchLimitPerRun: 50,
        buildLimitPerRun: 20,
        dailyCap: 200,
        canIngestPrayers: true,
        canIngestLiturgy: true,
      }),
    ]);
    const report = await getSourceOnboardingReport();
    const row = report.sources[0];
    expect(row.discoveryMethod).toBe("sitemap");
    expect(row.role).toBe("primary_content_source");
    expect(row.tier).toBe(1);
    expect(row.supportedContentTypes.sort()).toEqual(["Liturgy", "Prayer"]);
    expect(row.allowedFields).toMatch(/originate/);
    expect(row.licenseStatus).toBe("official (permitted)");
    expect(row.fetchCap).toBe(50);
    expect(row.buildCap).toBe(20);
    expect(row.dailyCap).toBe(200);
    expect(row.sourceHealth).toBe("active");
  });

  it("warns when a content type has a validation source but no primary", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      source({
        id: "v1",
        host: "validator.example",
        role: "validation_source",
        discoveryMethod: "sitemap",
        canIngestPrayers: true,
      }),
    ]);
    const report = await getSourceOnboardingReport();
    expect(
      report.warnings.find(
        (w) => w.contentType === "Prayer" && w.kind === "validation_without_primary",
      ),
    ).toBeDefined();
  });

  it("warns when a factory-ready source has no successful builds", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      source({
        id: "p1",
        host: "primary.example",
        role: "primary_content_source",
        discoveryMethod: "sitemap",
        canIngestPrayers: true,
      }),
    ]);
    // contentPackageBuildLog.groupBy defaults to [] — no builds anywhere.
    const report = await getSourceOnboardingReport();
    expect(
      report.warnings.find(
        (w) => w.contentType === "Prayer" && w.kind === "sources_without_builds",
      ),
    ).toBeDefined();
  });
});
