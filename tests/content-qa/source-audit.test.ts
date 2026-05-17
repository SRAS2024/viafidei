/**
 * Source audit — answers the 10/10 question "why is this source
 * trusted or paused?"
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getSourceAudit } from "@/lib/content-qa/source-audit";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionSource.findUnique.mockResolvedValue(null);
  prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getSourceAudit", () => {
  it("returns a tier-1 official source as trusted + active", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      name: "Vatican",
      host: "vatican.va",
      tier: 1,
      trustLabel: "Official Church",
      isOfficial: true,
      healthState: "active",
      pausedAt: null,
      pausedReason: null,
      autoPaused: false,
      autoPausedAt: null,
      consecutiveFailures: 0,
      lowQualityRatio: 0.05,
      completedItems: 200,
      rejectedItems: 5,
      discoveredItems: 250,
      lastSuccessfulSync: new Date(),
      lastFailedSync: null,
      lastContentUpdateAt: new Date(),
      exhaustedAt: null,
    });
    const out = await getSourceAudit({ sourceIdOrHost: "vatican.va" });
    expect(out.found).toBe(true);
    expect(out.source?.tier).toBe(1);
    expect(out.trustExplanation).toMatch(/Tier\s+1/);
    expect(out.trustExplanation).toMatch(/Active\s+and\s+healthy/);
  });

  it("returns a paused source with the reason in the explanation", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-paused",
      name: "Flaky",
      host: "flaky.example",
      tier: 3,
      trustLabel: null,
      isOfficial: false,
      healthState: "paused",
      pausedAt: new Date(),
      pausedReason: "Auto-paused — low-quality ratio 0.85 exceeded 0.7",
      autoPaused: true,
      autoPausedAt: new Date(),
      consecutiveFailures: 0,
      lowQualityRatio: 0.85,
      completedItems: 10,
      rejectedItems: 90,
      discoveredItems: 100,
      lastSuccessfulSync: null,
      lastFailedSync: new Date(),
      lastContentUpdateAt: null,
      exhaustedAt: null,
    });
    const out = await getSourceAudit({ sourceIdOrHost: "flaky.example" });
    expect(out.found).toBe(true);
    expect(out.trustExplanation).toMatch(/PAUSED/);
    expect(out.trustExplanation).toMatch(/low-quality\s+ratio/i);
    expect(out.trustExplanation).toMatch(/85%/);
  });

  it("includes recent rejected counts grouped by category and content type", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-mix",
      name: "Mixed",
      host: "mixed.example",
      tier: 2,
      trustLabel: null,
      isOfficial: false,
      healthState: "active",
      pausedAt: null,
      pausedReason: null,
      autoPaused: false,
      autoPausedAt: null,
      consecutiveFailures: 0,
      lowQualityRatio: 0.3,
      completedItems: 50,
      rejectedItems: 20,
      discoveredItems: 70,
      lastSuccessfulSync: new Date(),
      lastFailedSync: null,
      lastContentUpdateAt: null,
      exhaustedAt: null,
    });
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([
      { contentType: "Prayer", failureCategory: "wrong_content" },
      { contentType: "Prayer", failureCategory: "wrong_content" },
      { contentType: "Saint", failureCategory: "missing_required_field" },
    ] as unknown as never);
    const out = await getSourceAudit({ sourceIdOrHost: "mixed.example" });
    expect(out.recentRejected.last7d).toBe(3);
    expect(out.recentRejected.byFailureCategory.wrong_content).toBe(2);
    expect(out.recentRejected.byFailureCategory.missing_required_field).toBe(1);
    expect(out.recentRejected.byContentType.Prayer).toBe(2);
  });

  it("returns found=false for an unknown source", async () => {
    const out = await getSourceAudit({ sourceIdOrHost: "nonexistent.example" });
    expect(out.found).toBe(false);
    expect(out.trustExplanation).toMatch(/No matching source/);
  });
});
