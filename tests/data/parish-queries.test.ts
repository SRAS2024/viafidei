/**
 * Parish directory queries (src/lib/data/published.ts).
 *
 * /parishes used to load the entire PARISH table and hand it to a client
 * component as props; at the 200,000-record goal that is tens of megabytes per
 * visitor. These tests pin the two things that keep it bounded: a real
 * LIMIT/OFFSET with a payload-free projection, and a bounding-box prefilter on
 * the indexed latitude/longitude columns before any haversine is computed.
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
import { listParishPage, listParishesNear } from "@/lib/data/published";

type Sql = { strings?: string[]; values: unknown[] };
const textOf = (sql: Sql): string => (sql.strings ?? []).join(" ? ");

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
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  memoClear();
});

describe("listParishPage", () => {
  it("selects a projection, never the payload, and pages in SQL", async () => {
    queryRaw.mockResolvedValueOnce([{ total: 1030n }]).mockResolvedValueOnce([row()]);
    const page = await listParishPage({ page: 2, pageSize: 30 });

    const listSql = queryRaw.mock.calls[1][0] as Sql;
    const text = textOf(listSql);
    expect(text).toContain("LIMIT");
    expect(text).toContain("OFFSET");
    expect(listSql.values).toContain(30);
    expect(listSql.values).toContain(30); // offset = (2 - 1) * 30
    // Only the named JSON keys are read out — not the whole payload.
    expect(text).toContain("payload->>'address'");
    expect(text).not.toMatch(/SELECT[^]*"payload"[^]*FROM/);

    expect(page.total).toBe(1030);
    expect(page.pageCount).toBe(Math.ceil(1030 / 30));
    expect(page.items[0]).toMatchObject({
      designation: "parish",
      location: "110 W Madison St, Chicago, IL",
      href: "/parishes/st-peters-chicago",
    });
  });

  it("filters on the indexed subtype column and on a title search", async () => {
    queryRaw.mockResolvedValue([{ total: 0n }]);
    await listParishPage({ q: "john", class: "shrine" });
    const sql = queryRaw.mock.calls[0][0] as Sql;
    expect(textOf(sql)).toContain('"subtype" = ANY');
    expect(sql.values).toContain("%john%");
    expect(sql.values).toEqual(expect.arrayContaining([["shrine"]]));
  });
});

describe("listParishesNear", () => {
  it("prefilters with a bounding box before ordering by distance", async () => {
    queryRaw.mockResolvedValue([row({ distance_miles: 0.31 })]);
    const items = await listParishesNear({
      latitude: 41.8781,
      longitude: -87.6298,
      radiusMiles: 25,
      take: 10,
    });

    const sql = queryRaw.mock.calls[0][0] as Sql;
    const text = textOf(sql);
    expect(text).toContain('"latitude" BETWEEN');
    expect(text).toContain('"longitude" BETWEEN');
    // The haversine only orders what the box already narrowed.
    expect(text).toContain("acos");
    expect(text).toContain("ORDER BY");
    expect(sql.values).toContain(10);
    expect(items[0].distanceMiles).toBeCloseTo(0.31, 5);
  });

  it("drops the longitude bound rather than emitting a wrapped range", async () => {
    queryRaw.mockResolvedValue([]);
    await listParishesNear({ latitude: 0, longitude: 179.9, radiusMiles: 500 });
    expect(textOf(queryRaw.mock.calls[0][0] as Sql)).not.toContain('"longitude" BETWEEN');
  });

  it("never returns a record outside the requested radius", async () => {
    // The bounding box is a square, so its corners exceed the radius; the
    // haversine result is the authority.
    queryRaw.mockResolvedValue([
      row({ distance_miles: 9 }),
      row({ id: "p2", slug: "far", distance_miles: 61 }),
    ]);
    const items = await listParishesNear({ latitude: 40, longitude: -80, radiusMiles: 50 });
    expect(items.map((i) => i.slug)).toEqual(["st-peters-chicago"]);
  });

  it("refuses an impossible coordinate without touching the database", async () => {
    expect(await listParishesNear({ latitude: 999, longitude: 0 })).toEqual([]);
    expect(await listParishesNear({ latitude: 0, longitude: Number.NaN })).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("caps the result set so a crafted ?take cannot unbound the response", async () => {
    queryRaw.mockResolvedValue([]);
    await listParishesNear({ latitude: 0, longitude: 0, take: 100_000 });
    expect((queryRaw.mock.calls[0][0] as Sql).values).toContain(50);
  });
});
