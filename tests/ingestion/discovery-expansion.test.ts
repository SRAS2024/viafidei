/**
 * Discovery expansion planning tests (spec §4, §15).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { planDiscoveryExpansion } from "@/lib/ingestion/sources/discovery-expansion";

beforeEach(() => {
  resetPrismaMock();
});

describe("planDiscoveryExpansion()", () => {
  it("returns no shortfalls when every content type meets the minimum", async () => {
    // Manufacture 6 fully-configured sources per purpose flag so the
    // source plan reports zero shortfalls.
    const allFlags = [
      "canIngestPrayers",
      "canIngestSaints",
      "canIngestApparitions",
      "canIngestParishes",
      "canIngestDevotions",
      "canIngestNovenas",
      "canIngestSacraments",
      "canIngestRosaryGuides",
      "canIngestConsecrations",
      "canIngestSpiritualGuides",
      "canIngestLiturgy",
      "canIngestHistory",
    ];
    const sources = Array.from({ length: 6 }, () => {
      const row: Record<string, unknown> = {
        id: Math.random().toString(36),
        isActive: true,
        pausedAt: null,
        role: "primary_content_source",
        discoveryMethod: "sitemap",
        configurationStatus: "factory_native",
      };
      for (const flag of allFlags) row[flag] = true;
      return row;
    });
    prismaMock.ingestionSource.findMany.mockResolvedValue(sources);
    const plan = await planDiscoveryExpansion();
    expect(plan.shortfalls).toHaveLength(0);
    expect(plan.totalEnqueueIntent).toBe(0);
  });

  it("produces a shortfall row when a content type is below the minimum", async () => {
    // First call (source-plan): 1 prayer source (vs. min of 5).
    let callIdx = 0;
    prismaMock.ingestionSource.findMany.mockImplementation(async () => {
      callIdx += 1;
      if (callIdx === 1) {
        // source-plan query
        return [
          {
            id: "s1",
            isActive: true,
            pausedAt: null,
            role: "primary_content_source",
            discoveryMethod: "sitemap",
            configurationStatus: "factory_native",
            canIngestPrayers: true,
            canIngestSaints: false,
            canIngestApparitions: false,
            canIngestParishes: false,
            canIngestDevotions: false,
            canIngestNovenas: false,
            canIngestSacraments: false,
            canIngestRosaryGuides: false,
            canIngestConsecrations: false,
            canIngestLiturgy: false,
            canIngestHistory: false,
          },
        ];
      }
      // Subsequent calls (per-content-type candidate queries) — return
      // the same single candidate row for any content type asked.
      return [{ id: `candidate-${callIdx}` }];
    });

    const plan = await planDiscoveryExpansion({ maxPerTick: 50 });
    // Every spec content type is short (Prayer has 1 ready, the
    // rest have 0); we expect at least one shortfall row.
    expect(plan.shortfalls.length).toBeGreaterThan(0);
    expect(plan.totalEnqueueIntent).toBeGreaterThan(0);
  });

  it("caps total enqueue intent at maxPerTick", async () => {
    let callIdx = 0;
    prismaMock.ingestionSource.findMany.mockImplementation(async () => {
      callIdx += 1;
      if (callIdx === 1) {
        return []; // empty source-plan → every content type at zero
      }
      // Always 100 candidate rows available per content type.
      return Array.from({ length: 100 }, (_, i) => ({
        id: `c-${callIdx}-${i}`,
      }));
    });
    const plan = await planDiscoveryExpansion({ maxPerTick: 5 });
    expect(plan.totalEnqueueIntent).toBeLessThanOrEqual(5);
  });
});
