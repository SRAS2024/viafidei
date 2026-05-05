import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import {
  fetchOsmParishById,
  findOsmParishesNear,
  searchOsmParishes,
} from "@/lib/data/external-parishes";

let fetchSpy: MockInstance<Parameters<typeof fetch>, ReturnType<typeof fetch>>;

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/**
 * Each fetch call gets a *fresh* Response so the body stream can be read on
 * every retry. `mockResolvedValue(new Response(...))` returns the same
 * instance, whose body becomes unreadable after the first .json() call.
 */
function mockEveryFetchReturning(body: unknown): void {
  fetchSpy.mockImplementation(async () => makeJsonResponse(body));
}

beforeEach(() => {
  // Re-spy in each test so a previous afterEach's mockRestore doesn't leave
  // us with the real fetch (which would try to hit the network).
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("findOsmParishesNear", () => {
  it("returns normalized, sorted, in-radius parishes", async () => {
    mockEveryFetchReturning({
      elements: [
        {
          type: "node",
          id: 111,
          lat: 40.7584,
          lon: -73.9762,
          tags: {
            name: "Saint Patrick's Cathedral",
            "addr:street": "5th Avenue",
            "addr:city": "New York",
            phone: "+1 212-753-2261",
            website: "https://saintpatrickscathedral.org",
          },
        },
        {
          // No name → must be filtered out.
          type: "node",
          id: 222,
          lat: 40.76,
          lon: -73.98,
          tags: {},
        },
        {
          // Out-of-radius → must be filtered out.
          type: "node",
          id: 333,
          lat: 0,
          lon: 0,
          tags: { name: "Far away church" },
        },
      ],
    });

    const results = await findOsmParishesNear(40.7585, -73.9763, 5);
    expect(results).toHaveLength(1);
    const entry = results[0];
    expect(entry.parish.name).toBe("Saint Patrick's Cathedral");
    expect(entry.parish.slug).toBe("osm-node-111");
    expect(entry.parish.source).toBe("osm");
    expect(entry.parish.websiteUrl).toBe("https://saintpatrickscathedral.org/");
    expect(entry.distanceKm).toBeLessThan(0.2);
  });

  it("returns an empty list when every Overpass endpoint errors", async () => {
    fetchSpy.mockRejectedValue(new Error("boom"));
    const results = await findOsmParishesNear(0, 0, 10);
    expect(results).toEqual([]);
    // Three Overpass endpoints attempted in series.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

describe("fetchOsmParishById", () => {
  it("returns null for slugs that do not match the osm-<type>-<id> pattern", async () => {
    expect(await fetchOsmParishById("not-an-osm-slug")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("hydrates a single parish from Overpass by id", async () => {
    mockEveryFetchReturning({
      elements: [
        {
          type: "way",
          id: 9999,
          center: { lat: 41.9022, lon: 12.4539 },
          tags: { name: "Saint Peter's Basilica", "addr:city": "Vatican City" },
        },
      ],
    });
    const parish = await fetchOsmParishById("osm-way-9999");
    expect(parish).not.toBeNull();
    expect(parish?.name).toBe("Saint Peter's Basilica");
    expect(parish?.city).toBe("Vatican City");
    expect(parish?.latitude).toBeCloseTo(41.9022, 4);
  });
});

describe("searchOsmParishes", () => {
  it("returns an empty list for too-short queries without hitting the network", async () => {
    expect(await searchOsmParishes("a")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns direct name matches when Overpass finds them", async () => {
    mockEveryFetchReturning({
      elements: [
        {
          type: "node",
          id: 7,
          lat: 48.853,
          lon: 2.3499,
          tags: { name: "Cathédrale Notre-Dame de Paris" },
        },
      ],
    });
    const items = await searchOsmParishes("Notre-Dame de Paris");
    expect(items).toHaveLength(1);
    expect(items[0].name).toContain("Notre-Dame");
  });
});
