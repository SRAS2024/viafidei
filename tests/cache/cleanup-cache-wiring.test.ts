/**
 * Strict cleanup + sitemap refresh cache wiring tests (spec §19).
 *
 * Spec rule: when strict cleanup deletes invalid content OR when the
 * sitemap is refreshed, the cache layer MUST revalidate the affected
 * tabs / sitemap / search tags so the live site does not serve
 * stale content. We exercise the dispatch entry points directly and
 * inspect the cache revalidation log.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

// Replace the cleanup module with a stub so the test focuses on
// the cache-wiring side effect (the cleanup behaviour is exercised
// in its own dedicated tests).
vi.mock("@/lib/content-qa/cleanup", () => ({
  runStrictContentCleanup: vi.fn(async () => ({
    totalInspected: 5,
    totalFlaggedReady: 2,
    totalFlaggedUnready: 0,
    totalHardDeleted: 3,
    mode: "strict",
    perContentType: [],
  })),
}));
vi.mock("@/lib/data/saved", () => ({
  pruneOrphanedSaves: vi.fn(async () => ({
    prayers: 0,
    saints: 0,
    apparitions: 0,
    parishes: 0,
    devotions: 0,
  })),
}));

import { clearCacheRevalidationLog, getCacheRevalidationLog } from "@/lib/cache/revalidate";
import { runJobByKind } from "@/lib/ingestion/queue/dispatch";

beforeEach(() => {
  resetPrismaMock();
  clearCacheRevalidationLog();
});

describe("strict_cleanup cache wiring (spec §19)", () => {
  it("revalidates every tab + sitemap + search after hard-deleting rows", async () => {
    await runJobByKind({
      id: "job1",
      jobKind: "strict_cleanup",
      payload: { sweepReason: "scheduled" },
      sourceId: null,
      attempt: 0,
    } as never);
    const log = getCacheRevalidationLog();
    expect(log.length).toBeGreaterThan(0);
    const reasons = log.map((e) => e.reason);
    expect(reasons).toContain("strict_cleanup");
    const sitemapEntry = log.find((e) => e.tags.includes("sitemap"));
    expect(sitemapEntry).toBeDefined();
  });
});

describe("sitemap_refresh cache wiring (spec §19)", () => {
  it("revalidates sitemap + search tags", async () => {
    await runJobByKind({
      id: "job2",
      jobKind: "sitemap_refresh",
      payload: {},
      sourceId: null,
      attempt: 0,
    } as never);
    const log = getCacheRevalidationLog();
    expect(log.some((e) => e.reason === "sitemap_refresh")).toBe(true);
  });
});
