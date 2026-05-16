import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { recordSourceFreshness, recordSourceQuality } from "@/lib/data/source-health";

beforeEach(() => {
  resetPrismaMock();
});

function existingSource(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "src1",
    name: "Test",
    host: "test.example.com",
    baseUrl: "https://test.example.com",
    sourceType: "rss",
    isOfficial: false,
    isActive: true,
    rateLimitPerMin: null,
    reliabilityScore: null,
    lastSuccessfulSync: null,
    lastFailedSync: null,
    lastContentUpdateAt: null,
    lastHttpStatus: null,
    lastEtag: null,
    lastModifiedHeader: null,
    tier: 3,
    trustLabel: null,
    healthState: "active",
    consecutiveFailures: 0,
    lowQualityRatio: null,
    pausedAt: null,
    pausedReason: null,
    requestSpacingMs: null,
    robotsRespect: true,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("source freshness — happy path", () => {
  it("records a successful fetch and clears consecutive failures", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(
      existingSource({ consecutiveFailures: 2 }),
    );
    let updateData: Record<string, unknown> | null = null;
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return existingSource(data);
      },
    );
    await recordSourceFreshness("src1", {
      ok: true,
      httpStatus: 200,
      etag: 'W/"abc"',
      lastModified: "Fri, 16 May 2026 04:00:00 GMT",
      contentChanged: true,
    });
    expect(updateData).not.toBeNull();
    expect((updateData as Record<string, unknown>).consecutiveFailures).toBe(0);
    expect((updateData as Record<string, unknown>).lastHttpStatus).toBe(200);
    expect((updateData as Record<string, unknown>).lastEtag).toBe('W/"abc"');
    expect((updateData as Record<string, unknown>).healthState).toBe("active");
  });

  it("flips to FAILING after enough consecutive failures", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(
      existingSource({ consecutiveFailures: 2 }),
    );
    let updateData: Record<string, unknown> | null = null;
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return existingSource(data);
      },
    );
    await recordSourceFreshness("src1", {
      ok: false,
      httpStatus: 503,
      errorMessage: "service unavailable",
    });
    expect((updateData as Record<string, unknown>).consecutiveFailures).toBe(3);
    expect((updateData as Record<string, unknown>).healthState).toBe("failing");
  });

  it("flips to BLOCKED for 403/451 even if previous state was active", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(existingSource());
    let updateData: Record<string, unknown> | null = null;
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return existingSource(data);
      },
    );
    await recordSourceFreshness("src1", {
      ok: false,
      httpStatus: 403,
      blocked: true,
    });
    expect((updateData as Record<string, unknown>).healthState).toBe("blocked");
  });

  it("does nothing when sourceId is null", async () => {
    await recordSourceFreshness(null, { ok: true });
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });

  it("recordSourceQuality blends the new ratio with the previous value", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(
      existingSource({ lowQualityRatio: 0.4, healthState: "active" }),
    );
    let updateData: Record<string, unknown> | null = null;
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return existingSource(data);
      },
    );
    await recordSourceQuality("src1", { totalItems: 10, reviewOrRejected: 8 });
    // Blended ratio = 0.4 * 0.7 + 0.8 * 0.3 = 0.52
    const ratio = (updateData as Record<string, unknown>).lowQualityRatio as number;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.8);
  });
});
