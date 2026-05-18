/**
 * Regression test: `content_revalidate` runs ONLY strict content
 * factory cleanup + package contract revalidation. The legacy
 * catalog janitor (text-shape repackage / divert-to-review) is
 * removed.
 *
 * - The dispatcher must not import or call runCatalogJanitor.
 * - A content_revalidate job must not produce any
 *   `divertedToReview` rows or `repackaged` rows in the response.
 * - The summary mentions only strict-QA counters.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const dispatchPath = join(process.cwd(), "src", "lib", "ingestion", "queue", "dispatch.ts");
const dispatchSrc = readFileSync(dispatchPath, "utf8");

beforeEach(() => {
  resetPrismaMock();
});

describe("content_revalidate does not run the legacy catalog janitor", () => {
  it("dispatch.ts does NOT import runCatalogJanitor", () => {
    expect(dispatchSrc).not.toMatch(/import\s+[^"']*runCatalogJanitor/);
    expect(dispatchSrc).not.toMatch(/\brunCatalogJanitor\s*\(/);
  });

  it("dispatch.ts does NOT import the catalog-janitor module", () => {
    expect(dispatchSrc).not.toMatch(/data\/catalog-janitor/);
  });

  it("the runContentRevalidate handler returns a summary that mentions only strict-QA counters", async () => {
    // Stub the strict cleanup module so we can read what the
    // dispatcher returned.
    vi.doMock("@/lib/content-qa/cleanup", () => ({
      runStrictContentCleanup: vi.fn().mockResolvedValue({
        totalInspected: 10,
        totalFlaggedReady: 5,
        totalFlaggedUnready: 2,
        totalHardDeleted: 1,
        totalLogFailures: 0,
        buckets: [],
        mode: "all_catalog_rows" as const,
        deleteAllInvalid: true,
        packageContractVersion: "1.1.0",
        ranAt: new Date(),
      }),
    }));
    const { runJobByKind } = await import("@/lib/ingestion/queue/dispatch");

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
      payload: { sweepReason: "scheduled", triggeredBy: "automatic" },
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
    // The legacy summary keys MUST not be present.
    expect(result.errorMessage ?? "").not.toMatch(/Repackaged/);
    expect(result.errorMessage ?? "").not.toMatch(/diverted/i);
    // The strict QA summary keys MUST be present.
    expect(result.errorMessage ?? "").toMatch(/strict-QA/);
    expect(result.errorMessage ?? "").toMatch(/packageContract/);
  });
});
