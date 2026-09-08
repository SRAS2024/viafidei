/**
 * `listParishesNear`'s unlimited mode (src/lib/data/published.ts).
 *
 * The bounded search is pinned in tests/data/parish-queries.test.ts. This file
 * covers the last rung of the locator's widening ladder — `radiusMiles: null`,
 * "the nearest records wherever they are" — which exists because directory
 * coverage is still regional and a visitor outside a covered region would
 * otherwise be shown a blank list.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn() },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { memoClear } from "@/lib/cache/memo";
import { listParishesNear } from "@/lib/data/published";

type Sql = { strings?: string[]; values: unknown[] };
const textOf = (sql: Sql): string => (sql.strings ?? []).join(" ? ");
const lastSql = (): Sql => queryRaw.mock.calls[0]![0] as Sql;

const row = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "st-peters-chicago",
  title: "St. Peter's Church",
  subtitle: "A Catholic parish",
  subtype: "parish",
  latitude: 41.88,
  longitude: -87.63,
  address: "110 W Madison St",
  city: "Chicago",
  state: "IL",
  country: "US",
  website: "https://example.org",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  memoClear();
});

describe("listParishesNear with no radius", () => {
  it("drops the bounding box and keeps records at any distance", async () => {
    queryRaw.mockResolvedValue([row({ distance_miles: 4_812 })]);
    const items = await listParishesNear({
      latitude: 39.7392,
      longitude: -104.9903,
      radiusMiles: null,
      take: 50,
    });

    const text = textOf(lastSql());
    expect(text).not.toContain('"latitude" BETWEEN');
    expect(text).not.toContain('"longitude" BETWEEN');
    // Un-geocoded rows would otherwise sort to the tail with a NULL distance.
    expect(text).toContain('"latitude" IS NOT NULL');
    expect(text).toContain("ORDER BY");
    // A bounded search would have discarded this row; an unlimited one is the
    // whole point of the last rung.
    expect(items.map((i) => i.distanceMiles)).toEqual([4_812]);
  });

  it("still caps the result set", async () => {
    queryRaw.mockResolvedValue([]);
    await listParishesNear({ latitude: 0, longitude: 0, radiusMiles: null, take: 100_000 });
    expect(lastSql().values).toContain(50);
  });

  it("still refuses an impossible coordinate without touching the database", async () => {
    expect(await listParishesNear({ latitude: 91, longitude: 0, radiusMiles: null })).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("keeps the bounding box whenever a radius IS given", async () => {
    queryRaw.mockResolvedValue([]);
    await listParishesNear({ latitude: 39.7392, longitude: -104.9903, radiusMiles: 150 });
    expect(textOf(lastSql())).toContain('"latitude" BETWEEN');
  });
});

describe("the projected parish row", () => {
  it("carries the street address and website the shared card renders", async () => {
    queryRaw.mockResolvedValue([row({ distance_miles: 0.2 })]);
    const [item] = await listParishesNear({ latitude: 41.88, longitude: -87.63 });
    expect(item).toMatchObject({
      address: "110 W Madison St",
      website: "https://example.org",
      location: "110 W Madison St, Chicago, IL",
    });
    expect(textOf(lastSql())).toContain("payload->>'website'");
  });

  it("normalises a missing website to null rather than undefined", async () => {
    queryRaw.mockResolvedValue([row({ website: undefined, address: undefined })]);
    const [item] = await listParishesNear({ latitude: 41.88, longitude: -87.63 });
    expect(item.website).toBeNull();
    expect(item.address).toBeNull();
  });
});
