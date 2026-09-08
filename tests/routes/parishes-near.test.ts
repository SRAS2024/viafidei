/**
 * GET /api/parishes/near — the progressive radius ladder.
 *
 * "Use my location" was never broken code: the button, the geolocation call
 * and this route all worked, and a Denver coordinate returned HTTP 200 with an
 * empty list because the directory's OSM sweep had not reached Colorado. An
 * empty list with no explanation reads as "there are no Catholic parishes near
 * you", which is false. So the route widens on its own and reports which
 * radius actually answered, and the page says so in words.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const listParishesNear = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listParishesNear: (...args: unknown[]) => listParishesNear(...args),
}));

import { NextRequest } from "next/server";

import { GET } from "@/app/api/parishes/near/route";

const req = (url: string) => new NextRequest(new Request(`http://localhost${url}`));
const denver = "/api/parishes/near?lat=39.7392&lng=-104.9903&radiusMiles=50";

type Body = {
  items: unknown[];
  total: number;
  requestedRadiusMiles: number;
  radiusMiles: number | null;
  widened: boolean;
};

const radiiTried = (): Array<number | null> =>
  listParishesNear.mock.calls.map((c) => (c[0] as { radiusMiles: number | null }).radiusMiles);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/parishes/near", () => {
  it("stops at the requested radius when it answers, and says it did not widen", async () => {
    listParishesNear.mockResolvedValue([{ slug: "st-peters", distanceMiles: 0.3 }]);
    const res = await GET(req(denver));
    const body = (await res.json()) as Body;

    expect(radiiTried()).toEqual([50]);
    expect(body).toMatchObject({
      total: 1,
      requestedRadiusMiles: 50,
      radiusMiles: 50,
      widened: false,
    });
    // A location-specific answer must never be cached by a shared proxy.
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("widens 50 -> 150 and reports the radius that actually produced the results", async () => {
    listParishesNear
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: "far", distanceMiles: 120 }]);

    const body = (await (await GET(req(denver))).json()) as Body;
    expect(radiiTried()).toEqual([50, 150]);
    expect(body).toMatchObject({ requestedRadiusMiles: 50, radiusMiles: 150, widened: true });
    expect(body.total).toBe(1);
  });

  it("falls all the way through to the nearest records at any distance", async () => {
    listParishesNear
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: "rome", distanceMiles: 5300 }]);

    const body = (await (await GET(req(denver))).json()) as Body;
    // The last rung is unlimited: nearest-N regardless of distance.
    expect(radiiTried()).toEqual([50, 150, 500, null]);
    expect(body).toMatchObject({ radiusMiles: null, widened: true, total: 1 });
  });

  it("never repeats the radius the caller already asked for", async () => {
    listParishesNear.mockResolvedValue([]);
    await GET(req("/api/parishes/near?lat=39.7392&lng=-104.9903&radiusMiles=500"));
    expect(radiiTried()).toEqual([500, null]);
  });

  it("clamps a crafted radius rather than trusting it", async () => {
    listParishesNear.mockResolvedValue([{ slug: "a" }]);
    await GET(req("/api/parishes/near?lat=0&lng=0&radiusMiles=99999"));
    expect(radiiTried()).toEqual([500]);

    vi.clearAllMocks();
    listParishesNear.mockResolvedValue([{ slug: "a" }]);
    await GET(req("/api/parishes/near?lat=0&lng=0&radiusMiles=abc"));
    expect(radiiTried()).toEqual([50]);
  });

  it("passes the coordinate through and caps the result set", async () => {
    listParishesNear.mockResolvedValue([{ slug: "st-peters" }]);
    await GET(req("/api/parishes/near?lat=41.88&lng=-87.63&radiusMiles=25"));
    expect(listParishesNear).toHaveBeenCalledWith({
      latitude: 41.88,
      longitude: -87.63,
      radiusMiles: 25,
      take: 50,
    });
  });

  it("rejects a missing, unparseable or impossible coordinate", async () => {
    for (const url of [
      "/api/parishes/near",
      "/api/parishes/near?lat=&lng=-87.63",
      "/api/parishes/near?lat=abc&lng=-87.63",
      // Out of range: walking the ladder would return the same empty list four
      // times over, so it is refused before the first query.
      "/api/parishes/near?lat=999&lng=0",
      "/api/parishes/near?lat=0&lng=-181",
    ]) {
      expect((await GET(req(url))).status).toBe(400);
    }
    expect(listParishesNear).not.toHaveBeenCalled();
  });

  it("degrades to an explained empty list rather than an error page", async () => {
    listParishesNear.mockRejectedValue(new Error("db down"));
    const res = await GET(req("/api/parishes/near?lat=0&lng=0"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.items).toEqual([]);
    expect(body).toMatchObject({ total: 0, radiusMiles: 50, widened: false });
  });

  it("reports an empty directory honestly instead of pretending it widened", async () => {
    listParishesNear.mockResolvedValue([]);
    const body = (await (await GET(req(denver))).json()) as Body;
    expect(body).toMatchObject({ items: [], total: 0, widened: false });
  });
});
