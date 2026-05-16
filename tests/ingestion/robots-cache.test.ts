import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getRobotsForDomain, pruneExpiredRobotsCache } from "@/lib/ingestion/robots-cache";

beforeEach(() => {
  resetPrismaMock();
});

describe("robots cache", () => {
  it("returns cached body when fresh", async () => {
    const now = new Date("2026-05-16T12:00:00Z");
    prismaMock.robotsCache.findUnique.mockResolvedValue({
      domain: "example.com",
      body: "User-agent: *\nDisallow: /admin",
      lastStatus: 200,
      fetchedAt: new Date(now.getTime() - 1000),
      expiresAt: new Date(now.getTime() + 3600_000),
    });
    const fetcher = vi.fn();
    const result = await getRobotsForDomain("example.com", fetcher, 6, now);
    expect(result.cached).toBe(true);
    expect(result.body).toMatch(/Disallow: \/admin/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refetches and upserts when cache is expired", async () => {
    const now = new Date("2026-05-16T12:00:00Z");
    prismaMock.robotsCache.findUnique.mockResolvedValue({
      domain: "example.com",
      body: "stale body",
      lastStatus: 200,
      fetchedAt: new Date(now.getTime() - 24 * 3600_000),
      expiresAt: new Date(now.getTime() - 1000),
    });
    prismaMock.robotsCache.upsert.mockResolvedValue({});
    const fetcher = vi.fn().mockResolvedValue({ status: 200, body: "fresh body" });
    const result = await getRobotsForDomain("example.com", fetcher, 6, now);
    expect(result.cached).toBe(false);
    expect(result.body).toBe("fresh body");
    expect(fetcher).toHaveBeenCalledWith("https://example.com/robots.txt");
    expect(prismaMock.robotsCache.upsert).toHaveBeenCalled();
  });

  it("falls back to cached body when fetch fails", async () => {
    const now = new Date("2026-05-16T12:00:00Z");
    prismaMock.robotsCache.findUnique.mockResolvedValue({
      domain: "example.com",
      body: "old body",
      lastStatus: 200,
      fetchedAt: new Date(now.getTime() - 24 * 3600_000),
      expiresAt: new Date(now.getTime() - 1000),
    });
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await getRobotsForDomain("example.com", fetcher, 6, now);
    expect(result.body).toBe("old body");
  });

  it("returns null body when no cache exists and fetch fails", async () => {
    prismaMock.robotsCache.findUnique.mockResolvedValue(null);
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await getRobotsForDomain("example.com", fetcher);
    expect(result.body).toBeNull();
  });

  it("pruneExpiredRobotsCache deletes rows older than 7 days", async () => {
    prismaMock.robotsCache.deleteMany.mockResolvedValue({ count: 3 });
    const count = await pruneExpiredRobotsCache();
    expect(count).toBe(3);
  });
});
