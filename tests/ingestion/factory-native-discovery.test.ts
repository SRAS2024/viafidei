/**
 * Factory-native source discovery: when an IngestionSource has a
 * `discoveryFeedUrl` set, the worker's source_discovery dispatch
 * walks the feed and enqueues source_fetch jobs — bypassing the
 * legacy adapter discovery entirely.
 *
 * These tests pin the behaviour:
 *
 *   * fetches the feed URL
 *   * extracts <loc> URLs
 *   * filters out cross-host URLs (defence-in-depth)
 *   * writes a DiscoveredSourceItem per URL
 *   * enqueues a source_fetch job per URL
 *   * NEVER calls runAdapter for the discovery path
 *
 * Combined with the existing source_ingest removal, this proves
 * factory-native discovery is now a real, callable code path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runFactoryNativeDiscovery } from "@/lib/ingestion/queue/factory-native-discovery";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetPrismaMock();
  // Discovered-item upsert returns a fresh row id every call.
  prismaMock.discoveredSourceItem.upsert.mockImplementation(async () => ({
    id: `disc_${Math.random().toString(36).slice(2, 8)}`,
  }));
  prismaMock.ingestionJobQueue.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `q_${Math.random().toString(36).slice(2, 8)}`,
      ...data,
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: null,
      finishedAt: null,
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: null,
      lastError: null,
      payload: data.payload ?? null,
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: null,
      cancelRequestedAt: null,
      cancelReason: null,
      canceledAt: null,
      durationMs: null,
      dedupeKey: data.dedupeKey ?? null,
      contentType: null,
      sourceId: null,
      jobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.queueAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(body: string, status = 200): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }) as unknown as typeof fetch;
}

function buildSitemap(urls: string[]): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls.map((u) => `<url><loc>${u}</loc></url>`),
    `</urlset>`,
  ].join("\n");
}

describe("factory-native source discovery", () => {
  it("fetches the feed, extracts URLs, writes DiscoveredSourceItem, and enqueues source_fetch", async () => {
    const urls = [
      "https://vatican.va/prayers/anima-christi",
      "https://vatican.va/prayers/ave-maria",
      "https://vatican.va/prayers/our-father",
    ];
    mockFetchOnce(buildSitemap(urls));

    const enqueuedKinds: string[] = [];
    prismaMock.ingestionJobQueue.create.mockImplementation(
      async ({ data }: { data: { jobKind: string } }) => {
        enqueuedKinds.push(data.jobKind);
        return {
          id: `q_${enqueuedKinds.length}`,
          jobKind: data.jobKind,
          ...data,
        };
      },
    );

    const result = await runFactoryNativeDiscovery({
      sourceId: "src-vatican",
      sourceHost: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
      workerJobId: "queue-row-1",
    });

    expect(result.ok).toBe(true);
    expect(result.feedUrlCount).toBe(3);
    expect(result.enqueuedCount).toBe(3);
    // Every enqueued job is source_fetch — NEVER source_ingest or anything else.
    expect(enqueuedKinds).toEqual(["source_fetch", "source_fetch", "source_fetch"]);
    expect(prismaMock.discoveredSourceItem.upsert).toHaveBeenCalledTimes(3);
  });

  it("filters out cross-host URLs (defence-in-depth against poisoned sitemaps)", async () => {
    const urls = [
      "https://vatican.va/prayers/ours",
      "https://evil.example.com/payload",
      "https://vatican.va/prayers/also-ours",
    ];
    mockFetchOnce(buildSitemap(urls));

    const result = await runFactoryNativeDiscovery({
      sourceId: "src-vatican",
      sourceHost: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
      workerJobId: "queue-row-2",
    });

    // Only 2 of the 3 URLs are same-host.
    expect(result.feedUrlCount).toBe(2);
    expect(result.enqueuedCount).toBe(2);
    // The cross-host URL never makes it to discovered-items.
    expect(prismaMock.discoveredSourceItem.upsert).toHaveBeenCalledTimes(2);
  });

  it("returns a clear error when the feed fetch returns non-2xx", async () => {
    mockFetchOnce("not found", 404);

    const result = await runFactoryNativeDiscovery({
      sourceId: "src-bad",
      sourceHost: "broken.example.com",
      discoveryFeedUrl: "https://broken.example.com/sitemap.xml",
      workerJobId: "queue-row-3",
    });

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/Feed fetch failed: HTTP 404/);
    expect(prismaMock.discoveredSourceItem.upsert).not.toHaveBeenCalled();
    expect(prismaMock.ingestionJobQueue.create).not.toHaveBeenCalled();
  });

  it("caps URLs per run so a giant sitemap doesn't pile thousands of jobs at once", async () => {
    const urls = Array.from({ length: 500 }, (_, i) => `https://vatican.va/page-${i}`);
    mockFetchOnce(buildSitemap(urls));

    const result = await runFactoryNativeDiscovery({
      sourceId: "src-big",
      sourceHost: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
      workerJobId: "queue-row-4",
      maxUrlsPerRun: 50,
    });

    expect(result.feedUrlCount).toBe(500);
    expect(result.enqueuedCount).toBe(50);
    expect(prismaMock.discoveredSourceItem.upsert).toHaveBeenCalledTimes(50);
  });

  it("dedup key for each source_fetch job is the URL — re-running is idempotent", async () => {
    const urls = ["https://vatican.va/prayers/anima-christi"];
    mockFetchOnce(buildSitemap(urls));

    const seenDedupeKeys: Array<string | null> = [];
    prismaMock.ingestionJobQueue.create.mockImplementation(
      async ({ data }: { data: { dedupeKey: string | null } }) => {
        seenDedupeKeys.push(data.dedupeKey);
        return { id: "q1", ...data };
      },
    );

    await runFactoryNativeDiscovery({
      sourceId: "src-vatican",
      sourceHost: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
      workerJobId: "queue-row-5",
    });

    expect(seenDedupeKeys).toEqual(["source_fetch:https://vatican.va/prayers/anima-christi"]);
  });
});
