/**
 * Paged, projected reads (src/lib/data/published.ts).
 *
 * These replace the "load the whole content type and slice in JS" pattern the
 * public list pages used. What matters here is the SHAPE of the query the data
 * layer builds — skip/take, the projection, the indexed order and the indexed
 * filter — because that is what stops /saints and /parishes from materialising
 * the whole table on every request.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const count = vi.fn();
const groupBy = vi.fn();
const queryRaw = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      groupBy: (...args: unknown[]) => groupBy(...args),
      findFirst: vi.fn(),
    },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { memoClear } from "@/lib/cache/memo";
import {
  countPublishedBySubtype,
  listFeaturedPrayers,
  listPublishedPage,
  listSaintsForFeast,
  DEFAULT_PAGE_SIZE,
} from "@/lib/data/published";

function saintRow(over: Record<string, unknown> = {}) {
  return {
    id: "id-1",
    checklistItemId: "ci-1",
    contentType: "SAINT",
    slug: "agnes-of-rome",
    title: "Agnes of Rome",
    subtitle: "Virgin and martyr",
    subtype: "martyr",
    payload: { deathDate: "304" },
    authorityLevel: "MAGISTERIAL",
    version: 1,
    publishedAt: new Date("2026-01-01"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  memoClear();
});

describe("listPublishedPage", () => {
  it("pages in SQL with a projection instead of loading the type", async () => {
    count.mockResolvedValue(1896);
    findMany.mockResolvedValue([saintRow()]);

    const page = await listPublishedPage("SAINT", { page: 3, pageSize: 30 });

    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.skip).toBe(60);
    expect(args.take).toBe(30);
    // A projection, and specifically NOT the payload.
    expect(Object.keys(args.select as object).sort()).toEqual([
      "contentType",
      "id",
      "slug",
      "subtitle",
      "subtype",
      "title",
    ]);
    expect(page.total).toBe(1896);
    expect(page.pageCount).toBe(Math.ceil(1896 / 30));
    expect(page.items[0].href).toBe("/saints/agnes-of-rome");
  });

  it("orders chronologically on the indexed sortYear column, undated last", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await listPublishedPage("SAINT", { order: "chronological" });
    const args = findMany.mock.calls[0][0] as { orderBy: unknown[] };
    expect(args.orderBy).toEqual([{ sortYear: { sort: "asc", nulls: "last" } }, { title: "asc" }]);
  });

  it("orders by the indexed feast columns for the feast order", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await listPublishedPage("SAINT", { order: "feast" });
    const args = findMany.mock.calls[0][0] as { orderBy: Array<Record<string, unknown>> };
    expect(Object.keys(args.orderBy[0])).toEqual(["feastMonth"]);
    expect(Object.keys(args.orderBy[1])).toEqual(["feastDayOfMonth"]);
  });

  it("filters on the indexed subtype column, one value or several", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await listPublishedPage("GUIDE", { subtype: "sacrament" });
    expect((findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where).toMatchObject({
      subtype: { in: ["sacrament"] },
    });

    findMany.mockClear();
    await listPublishedPage("GUIDE", { subtype: ["sacrament", "prayer"] });
    expect((findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where).toMatchObject({
      subtype: { in: ["sacrament", "prayer"] },
    });
  });

  it("clamps hostile paging input rather than trusting the query string", async () => {
    count.mockResolvedValue(10);
    findMany.mockResolvedValue([]);
    const page = await listPublishedPage("SAINT", { page: -4, pageSize: 100_000 });
    const args = findMany.mock.calls[0][0] as { skip: number; take: number };
    expect(args.skip).toBe(0);
    expect(args.take).toBe(100);
    expect(page.page).toBe(1);
  });

  it("defaults to thirty rows a page", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await listPublishedPage("PARISH");
    expect((findMany.mock.calls[0][0] as { take: number }).take).toBe(DEFAULT_PAGE_SIZE);
    expect(DEFAULT_PAGE_SIZE).toBe(30);
  });
});

describe("countPublishedBySubtype", () => {
  it("returns counts per subtype for filter-chip presence, and memoises them", async () => {
    groupBy.mockResolvedValue([
      { subtype: "martyr", _count: { _all: 407 } },
      { subtype: null, _count: { _all: 3 } },
    ]);
    expect(await countPublishedBySubtype("SAINT")).toEqual({ martyr: 407 });
    // Second call is served from the memo — chips do not need to be live.
    await countPublishedBySubtype("SAINT");
    expect(groupBy).toHaveBeenCalledTimes(1);
  });
});

describe("listSaintsForFeast", () => {
  it("queries the indexed feast columns", async () => {
    findMany.mockResolvedValue([saintRow()]);
    const saints = await listSaintsForFeast(1, 21);
    expect((findMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      contentType: "SAINT",
      isPublished: true,
      feastMonth: 1,
      feastDayOfMonth: 21,
    });
    expect(saints).toHaveLength(1);
  });

  it("falls back to the legacy payload.feastDay string when the columns find nothing", async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([saintRow()]);
    const saints = await listSaintsForFeast(1, 21);
    expect((findMany.mock.calls[1][0] as { where: { payload: unknown } }).where.payload).toEqual({
      path: ["feastDay"],
      equals: "01-21",
    });
    expect(saints).toHaveLength(1);
  });

  it("rejects impossible dates without touching the database", async () => {
    expect(await listSaintsForFeast(13, 1)).toEqual([]);
    expect(await listSaintsForFeast(2, 40)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("orders foundational saints first (the site's saint order)", async () => {
    findMany.mockResolvedValue([
      saintRow({ id: "b", slug: "later", title: "Later Saint", payload: { deathDate: "1900" } }),
      saintRow({ id: "a", slug: "peter", title: "Peter", payload: { saintType: "apostle" } }),
    ]);
    const saints = await listSaintsForFeast(6, 29);
    expect(saints.map((s) => s.slug)).toEqual(["peter", "later"]);
  });
});

describe("listFeaturedPrayers", () => {
  it("rotates deterministically by day and never loads prayer bodies", async () => {
    queryRaw.mockResolvedValue([
      { id: "1", slug: "act-of-faith", title: "Act of Faith", subtype: "act", category: null },
    ]);
    const items = await listFeaturedPrayers("2026-09-07");
    const sql = queryRaw.mock.calls[0][0] as { strings?: string[]; values: unknown[] };
    const text = (sql.strings ?? []).join("?");
    expect(text).toContain("md5");
    expect(text).not.toContain("payload->>'body'");
    expect(sql.values).toContain("2026-09-07");
    // Acts of Faith/Hope/Love are their own category, not Penitential.
    expect(items[0].category).toBe("act");
    expect(items[0].categoryLabel).toBe("Acts");
    expect(items[0].href).toBe("/prayers/act-of-faith");
  });

  it("memoises per day key, so a burst of homepage views costs one query", async () => {
    queryRaw.mockResolvedValue([]);
    await listFeaturedPrayers("2026-09-07");
    await listFeaturedPrayers("2026-09-07");
    expect(queryRaw).toHaveBeenCalledTimes(1);
    await listFeaturedPrayers("2026-09-08");
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
