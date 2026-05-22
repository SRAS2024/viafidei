/**
 * runDiscoveryExpansion() tests (spec §4, §16).
 *
 * The previous batch added planDiscoveryExpansion() but nothing
 * called it — the spec's "automatic source discovery expansion when
 * a content type is under target" was unwired. runDiscoveryExpansion()
 * closes that: it runs the planner AND enqueues a source_discovery
 * job per candidate source.
 *
 * These tests pin:
 *   - the planner's shortfalls become enqueue calls
 *   - every enqueue is jobKind source_discovery
 *   - a per-(sourceId, day) dedupe key prevents duplicate rows
 *   - enqueue failures are counted but do not abort the run
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runDiscoveryExpansion } from "@/lib/ingestion/sources/discovery-expansion";

beforeEach(() => {
  resetPrismaMock();
});

describe("runDiscoveryExpansion()", () => {
  it("enqueues a source_discovery job per candidate when content types are under target", async () => {
    // First findMany call = source-plan query → return empty so
    // every content type is at zero (under target). Subsequent calls
    // = per-content-type candidate queries → return one candidate.
    let callIdx = 0;
    prismaMock.ingestionSource.findMany.mockImplementation(async () => {
      callIdx += 1;
      if (callIdx === 1) return [];
      return [{ id: `candidate-${callIdx}` }];
    });
    const enqueued: Array<Record<string, unknown>> = [];
    const result = await runDiscoveryExpansion({
      enqueue: async (input) => {
        enqueued.push(input);
        return { id: "q" };
      },
      maxPerTick: 50,
    });
    expect(result.contentTypesUnderTarget).toBeGreaterThan(0);
    expect(result.discoveryJobsEnqueued).toBe(enqueued.length);
    expect(enqueued.length).toBeGreaterThan(0);
    for (const e of enqueued) {
      expect(e.jobKind).toBe("source_discovery");
      expect(e.triggeredBy).toBe("automatic");
      expect(typeof e.dedupeKey).toBe("string");
      // Spec #5: per-content-type dedupe so a source with multiple
      // shortfalls doesn't have one type's discovery collapse another's.
      expect(String(e.dedupeKey)).toMatch(/^discovery_expansion:/);
      expect(e.contentType).toBeTruthy();
      // Payload now carries the adapterKey + content type per spec #5.
      const payload = e.payload as Record<string, unknown> | undefined;
      expect(payload?.contentType).toBe(e.contentType);
      expect(typeof payload?.adapterKey).toBe("string");
    }
  });

  it("enqueues nothing when every content type meets its minimum", async () => {
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
    const sources = Array.from({ length: 6 }, (_, i) => {
      const row: Record<string, unknown> = {
        id: `s${i}`,
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
    const enqueued: unknown[] = [];
    const result = await runDiscoveryExpansion({
      enqueue: async (input) => {
        enqueued.push(input);
        return { id: "q" };
      },
    });
    expect(result.contentTypesUnderTarget).toBe(0);
    expect(result.discoveryJobsEnqueued).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  it("counts enqueue failures without aborting the run", async () => {
    let callIdx = 0;
    prismaMock.ingestionSource.findMany.mockImplementation(async () => {
      callIdx += 1;
      if (callIdx === 1) return [];
      return [{ id: `candidate-${callIdx}` }];
    });
    const result = await runDiscoveryExpansion({
      enqueue: async () => {
        throw new Error("queue full");
      },
      maxPerTick: 10,
    });
    expect(result.errors).toBeGreaterThan(0);
    expect(result.discoveryJobsEnqueued).toBe(0);
  });

  it("uses a per-(sourceId, day) dedupe key so a second tick same day does not duplicate", async () => {
    let callIdx = 0;
    prismaMock.ingestionSource.findMany.mockImplementation(async () => {
      callIdx += 1;
      if (callIdx % 12 === 1) return [];
      return [{ id: "stable-candidate" }];
    });
    const keys: string[] = [];
    const enqueue = async (input: { dedupeKey: string }) => {
      keys.push(input.dedupeKey);
      return { id: "q" };
    };
    await runDiscoveryExpansion({ enqueue, maxPerTick: 50 });
    const firstRunKeys = [...keys];
    keys.length = 0;
    callIdx = 0;
    await runDiscoveryExpansion({ enqueue, maxPerTick: 50 });
    // Same day → identical dedupe keys, so the durable queue's
    // unique-by-dedupeKey constraint collapses the second run.
    expect(keys).toEqual(firstRunKeys);
  });
});
