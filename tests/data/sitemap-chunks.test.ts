/**
 * Chunked sitemap data (src/lib/data/sitemap.ts).
 *
 * One `<urlset>` may hold 50,000 URLs; the site's content goals sum to more
 * than 210,000. Past the limit Search Console rejects the file outright and
 * stops discovering new content — so the index/chunk split is a correctness
 * requirement, not an optimisation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const groupBy = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: {
      findMany: (...args: unknown[]) => findMany(...args),
      groupBy: (...args: unknown[]) => groupBy(...args),
    },
  },
}));

import { memoClear } from "@/lib/cache/memo";
import { SITEMAP_CHUNK_SIZE, listSitemapChunks, listSitemapUrls } from "@/lib/data/sitemap";

beforeEach(() => {
  vi.clearAllMocks();
  memoClear();
});

describe("listSitemapChunks", () => {
  it("splits a content type that exceeds the per-file limit", async () => {
    groupBy.mockResolvedValue([
      {
        contentType: "PARISH",
        _count: { _all: SITEMAP_CHUNK_SIZE * 2 + 1 },
        _max: { updatedAt: new Date("2026-09-01") },
      },
      { contentType: "SAINT", _count: { _all: 1896 }, _max: { updatedAt: new Date("2026-09-02") } },
    ]);
    const chunks = await listSitemapChunks();
    expect(chunks.filter((c) => c.key === "parish").map((c) => c.chunk)).toEqual([0, 1, 2]);
    expect(chunks.filter((c) => c.key === "saint")).toHaveLength(1);
    // The static pages are always listed, so the index is never empty.
    expect(chunks[0].key).toBe("pages");
    expect(SITEMAP_CHUNK_SIZE).toBeLessThanOrEqual(50_000);
  });

  it("still serves the static chunk when the database is unreachable", async () => {
    groupBy.mockRejectedValue(new Error("connection refused"));
    const chunks = await listSitemapChunks();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].key).toBe("pages");
  });
});

describe("listSitemapUrls", () => {
  it("returns the static paths for the pages chunk without a query", async () => {
    const urls = await listSitemapUrls("pages", 0);
    expect(urls.some((u) => u.loc === "")).toBe(true);
    expect(urls.some((u) => u.loc === "/saints")).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("selects only slug + updatedAt, ordered by id so chunk edges stay stable", async () => {
    findMany.mockResolvedValue([{ slug: "agnes-of-rome", updatedAt: new Date("2026-01-01") }]);
    const urls = await listSitemapUrls("saint", 2);
    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.select).toEqual({ slug: true, updatedAt: true });
    expect(args.orderBy).toEqual({ id: "asc" });
    expect(args.skip).toBe(2 * SITEMAP_CHUNK_SIZE);
    expect(args.take).toBe(SITEMAP_CHUNK_SIZE);
    expect(urls[0].loc).toBe("/saints/agnes-of-rome");
  });

  it("answers an unknown or guessed segment with an empty list, not an error", async () => {
    expect(await listSitemapUrls("not-a-type-123", 0)).toEqual([]);
    expect(await listSitemapUrls("pages", 4)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("memoises a chunk — crawlers re-fetch far more often than we publish", async () => {
    findMany.mockResolvedValue([]);
    await listSitemapUrls("saint", 0);
    await listSitemapUrls("saint", 0);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
