/**
 * The public JSON routes the site polls on every page view:
 * /api/saints/today, /api/prayers, /api/parishes/near, /api/search/suggest.
 *
 * Each of these used to read a whole content type per request. What is pinned
 * here is that they now delegate to an indexed, bounded data helper, that they
 * are cacheable where the answer is the same for everyone, and that hostile
 * query strings cannot unbound a response.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSaintsForFeast = vi.fn();
const listPublishedPage = vi.fn();
const listParishesNear = vi.fn();
const suggestPublished = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listSaintsForFeast: (...args: unknown[]) => listSaintsForFeast(...args),
  listPublishedPage: (...args: unknown[]) => listPublishedPage(...args),
  listParishesNear: (...args: unknown[]) => listParishesNear(...args),
  suggestPublished: (...args: unknown[]) => suggestPublished(...args),
}));

import { NextRequest } from "next/server";

import { GET as nearGet } from "@/app/api/parishes/near/route";
import { GET as prayersGet } from "@/app/api/prayers/route";
import { GET as saintsGet } from "@/app/api/saints/today/route";
import { GET as suggestGet } from "@/app/api/search/suggest/route";

const req = (url: string) => new NextRequest(new Request(`http://localhost${url}`));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/saints/today", () => {
  it("asks for the feast day by indexed month/day and caches the answer", async () => {
    listSaintsForFeast.mockResolvedValue([
      { slug: "agnes-of-rome", title: "Agnes of Rome", payload: { biography: "A Roman virgin" } },
      { slug: "meinrad", title: "Meinrad", payload: {} },
    ]);
    const res = await saintsGet(req("/api/saints/today?month=1&day=21&take=1"));
    const body = (await res.json()) as { total: number; items: Array<{ slug: string }> };

    expect(listSaintsForFeast).toHaveBeenCalledWith(1, 21);
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(1);
    // Same for every visitor until content changes — safe to share.
    expect(res.headers.get("cache-control")).toContain("s-maxage=600");
  });

  it("returns an empty result for an impossible date without querying", async () => {
    const res = await saintsGet(req("/api/saints/today?month=13&day=99"));
    expect((await res.json()).total).toBe(0);
    expect(listSaintsForFeast).not.toHaveBeenCalled();
  });
});

describe("GET /api/prayers", () => {
  it("turns skip/take into real SQL paging, clamped at the safety cap", async () => {
    listPublishedPage.mockResolvedValue({
      items: [],
      total: 1000,
      page: 1,
      pageSize: 200,
      pageCount: 5,
    });
    const res = await prayersGet(req("/api/prayers?take=10000&skip=400"));
    const body = (await res.json()) as { take: number; total: number; capped: boolean };

    const opts = listPublishedPage.mock.calls[0][1] as { pageSize: number; page: number };
    expect(opts.pageSize).toBe(200);
    expect(opts.page).toBe(3); // skip 400 / take 200 → third page
    expect(body.take).toBe(200);
    expect(body.capped).toBe(true);
  });

  it("filters litanies on the indexed subtype column", async () => {
    listPublishedPage.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });
    await prayersGet(req("/api/prayers?type=litany"));
    expect((listPublishedPage.mock.calls[0][1] as { subtype: string }).subtype).toBe("litany");
  });
});

describe("GET /api/parishes/near", () => {
  it("passes the coordinate through and caps the result set", async () => {
    listParishesNear.mockResolvedValue([{ slug: "st-peters", distanceMiles: 0.3 }]);
    const res = await nearGet(req("/api/parishes/near?lat=41.88&lng=-87.63&radiusMiles=25"));
    const body = (await res.json()) as { total: number };
    expect(listParishesNear).toHaveBeenCalledWith({
      latitude: 41.88,
      longitude: -87.63,
      radiusMiles: 25,
      take: 50,
    });
    expect(body.total).toBe(1);
    // A location-specific answer must never be cached by a shared proxy.
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("rejects a request with no coordinate", async () => {
    const res = await nearGet(req("/api/parishes/near"));
    expect(res.status).toBe(400);
    expect(listParishesNear).not.toHaveBeenCalled();
  });

  it("degrades to an empty list rather than an error page", async () => {
    listParishesNear.mockRejectedValue(new Error("db down"));
    const res = await nearGet(req("/api/parishes/near?lat=0&lng=0"));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
  });
});

describe("GET /api/search/suggest", () => {
  it("caches the shared answer and clamps the per-group limit", async () => {
    suggestPublished.mockResolvedValue([]);
    const res = await suggestGet(req("/api/search/suggest?q=mar&limit=99"));
    expect(suggestPublished).toHaveBeenCalledWith("mar", 5);
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
  });

  it("never lets the header search crash the page", async () => {
    suggestPublished.mockRejectedValue(new Error("boom"));
    const res = await suggestGet(req("/api/search/suggest?q=mar"));
    expect(res.status).toBe(200);
    expect((await res.json()).suggestions).toEqual([]);
  });
});
