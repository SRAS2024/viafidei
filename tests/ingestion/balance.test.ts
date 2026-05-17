/**
 * Content-type balancing tests. Verifies the planner's dynamic caps
 * react to queue distribution + threshold progress.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  computeBalanceDecision,
  effectiveContentTypeCap,
  effectiveSourceCap,
} from "@/lib/ingestion/queue/balance";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
  prismaMock.prayer.count.mockResolvedValue(0);
  prismaMock.saint.count.mockResolvedValue(0);
  prismaMock.parish.count.mockResolvedValue(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeBalanceDecision", () => {
  it("throttles a dominant content type", async () => {
    // Pump parish + prayer + saint counts above the underserved
    // threshold so they aren't also flagged as underserved (which
    // would override the dominance throttle).
    prismaMock.parish.count.mockResolvedValue(150_000);
    prismaMock.prayer.count.mockResolvedValue(500);
    prismaMock.saint.count.mockResolvedValue(7_000);
    prismaMock.ingestionJobQueue.groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
      if (by.includes("contentType")) {
        return [
          { contentType: "Parish", _count: { _all: 90 } },
          { contentType: "Prayer", _count: { _all: 10 } },
        ] as unknown as never;
      }
      return [] as unknown as never;
    });
    const decision = await computeBalanceDecision({
      baseContentTypeCap: 60,
      baseSourceCap: 10,
    });
    // Parish is >50% of the queue → throttle.
    expect(decision.contentTypeCap.Parish).toBeLessThan(60);
  });

  it("throttles a dominant source", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
      if (by.includes("sourceId")) {
        return [
          { sourceId: "src-1", _count: { _all: 80 } },
          { sourceId: "src-2", _count: { _all: 20 } },
        ] as unknown as never;
      }
      return [] as unknown as never;
    });
    const decision = await computeBalanceDecision({
      baseContentTypeCap: 60,
      baseSourceCap: 10,
    });
    expect(decision.dominantSources).toContain("src-1");
    expect(decision.sourceCap["src-1"]).toBeLessThan(10);
  });

  it("marks under-threshold content types as underserved", async () => {
    prismaMock.prayer.count.mockResolvedValue(10); // 10/500 = 2% of target — underserved
    prismaMock.saint.count.mockResolvedValue(6_500); // 6500/7000 = 92% — not underserved
    const decision = await computeBalanceDecision();
    expect(decision.underservedContentTypes).toContain("Prayer");
    expect(decision.underservedContentTypes).not.toContain("Saint");
  });

  it("boosts the cap for underserved content types", async () => {
    prismaMock.prayer.count.mockResolvedValue(10);
    const decision = await computeBalanceDecision({
      baseContentTypeCap: 60,
      baseSourceCap: 10,
    });
    expect(decision.contentTypeCap.Prayer).toBeGreaterThanOrEqual(60);
  });

  it("effectiveContentTypeCap falls back to the default when no override exists", async () => {
    // Pump prayers to target so it isn't flagged as underserved (which
    // would otherwise produce a boost-cap entry on every key).
    prismaMock.prayer.count.mockResolvedValue(500);
    prismaMock.saint.count.mockResolvedValue(7_000);
    prismaMock.parish.count.mockResolvedValue(150_000);
    const decision = await computeBalanceDecision();
    expect(effectiveContentTypeCap(decision, "Devotion", 60)).toBe(60);
  });

  it("effectiveSourceCap falls back to the default when no override exists", async () => {
    const decision = await computeBalanceDecision();
    expect(effectiveSourceCap(decision, "src-unknown", 10)).toBe(10);
  });
});
