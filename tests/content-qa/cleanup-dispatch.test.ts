/**
 * Verify that the content_revalidate dispatch path runs the strict
 * cleanup (Section 12: "catalog revalidation triggers strict cleanup").
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

// Stub the legacy catalog janitor so the test focuses on strict cleanup.
vi.mock("@/lib/data/catalog-janitor", () => ({
  runCatalogJanitor: vi.fn().mockResolvedValue({
    buckets: [],
    totalRepackaged: 0,
    totalDivertedToReview: 0,
    totalHardDeleted: 0,
  }),
}));

import { runJobByKind } from "@/lib/ingestion/queue/dispatch";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.spiritualLifeGuide,
    prismaMock.liturgyEntry,
    prismaMock.parish,
    prismaMock.dailyLiturgy,
  ]) {
    m.findMany.mockResolvedValue([]);
    m.delete.mockResolvedValue({});
    m.update.mockResolvedValue({});
  }
  prismaMock.rejectedContentLog.createMany.mockResolvedValue({ count: 0 });
  prismaMock.rejectedContentLog.create.mockResolvedValue({});
  prismaMock.dataManagementLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("content_revalidate dispatch", () => {
  it("invokes strict cleanup with the dispatched sweepReason", async () => {
    const result = await runJobByKind({
      id: "q1",
      sourceId: null,
      jobId: null,
      jobName: "content_revalidate",
      jobKind: "content_revalidate",
      dedupeKey: null,
      contentType: null,
      status: "running",
      priority: 100,
      attempts: 1,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      durationMs: null,
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: null,
      lastError: null,
      payload: { sweepReason: "post_ingestion", triggeredBy: "automatic" },
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: null,
      cancelRequestedAt: null,
      canceledAt: null,
      cancelReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.ok).toBe(true);
    // The cleanup writes a CLEANUP DataManagementLog row, proving the
    // strict cleanup ran.
    expect(prismaMock.dataManagementLog.create).toHaveBeenCalled();
    const createCall = prismaMock.dataManagementLog.create.mock.calls.find(
      (c) =>
        (c[0] as { data?: { action?: string; contentType?: string } })?.data?.action ===
          "CLEANUP" &&
        (c[0] as { data?: { action?: string; contentType?: string } })?.data?.contentType ===
          "ContentQA",
    );
    expect(createCall).toBeDefined();
  });

  it("rejects malformed content_revalidate payload at the boundary", async () => {
    const result = await runJobByKind({
      id: "q-bad",
      sourceId: null,
      jobId: null,
      jobName: "content_revalidate",
      jobKind: "content_revalidate",
      dedupeKey: null,
      contentType: null,
      status: "running",
      priority: 100,
      attempts: 1,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      durationMs: null,
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: null,
      lastError: null,
      // contentType "NotARealType" is rejected by the zod enum.
      payload: { contentType: "NotARealType" },
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: null,
      cancelRequestedAt: null,
      canceledAt: null,
      cancelReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/Invalid payload/);
  });
});
