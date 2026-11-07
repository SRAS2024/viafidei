/**
 * The saint list's own order, read in raw SQL because Prisma's orderBy cannot
 * express it (src/lib/data/published.ts). The order itself is checked against a
 * real database in the migration's local run; what is pinned here is the query:
 * the rank join, the hidden duplicates, the filter and the paging all survive, on
 * the plain list and on its search, and the count is the count of what is shown.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const count = vi.fn();
const queryRaw = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { memoClear } from "@/lib/cache/memo";
import { listPublishedPage, listSaintsForFeast } from "@/lib/data/published";

type Sql = { strings?: string[]; values: unknown[] };
const textOf = (sql: Sql): string => (sql.strings ?? []).join(" ? ");

const queries = () =>
  queryRaw.mock.calls
    .map((call) => call[0] as Sql)
    .filter((sql) => !textOf(sql).includes("information_schema.columns"));
const listQuery = () => queries().find((sql) => !textOf(sql).includes("count(*)"))!;
const countQuery = () => queries().find((sql) => textOf(sql).includes("count(*)"))!;
const values = (sql: Sql) => sql.values.flat() as unknown[];

function database(opts: { vector?: boolean; total?: number } = {}) {
  queryRaw.mockImplementation((sql: Sql) => {
    const text = textOf(sql);
    if (text.includes("information_schema.columns")) {
      return Promise.resolve([{ vector: opts.vector ?? true, trigram: false }]);
    }
    if (text.includes("count(*)")) return Promise.resolve([{ total: BigInt(opts.total ?? 100) }]);
    return Promise.resolve([
      {
        id: "1",
        contentType: "SAINT",
        slug: "saint-joseph",
        title: "Saint Joseph",
        subtitle: "Confessor",
        subtype: "confessor",
      },
    ]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  memoClear();
  // Both canonical records of these two pairs are live; the rest are not.
  findMany.mockResolvedValue([{ slug: "saint-john-the-apostle" }, { slug: "saint-jude-thaddeus" }]);
  database();
});

describe('listPublishedPage order "saints"', () => {
  it("joins the ranks and orders named saints, then the rest by year, then the Old Testament", async () => {
    await listPublishedPage("SAINT", { order: "saints", page: 2, pageSize: 30 });
    const text = textOf(listQuery());
    expect(text).toContain("LEFT JOIN unnest(");
    expect(text).toContain('"listRank" ASC NULLS LAST');
    expect(text).toContain('"sortYear" ASC NULLS LAST');
    expect(text).toContain('"slug" ASC');
    expect(text.indexOf("CASE")).toBeLessThan(text.indexOf('"listRank" ASC NULLS LAST'));
    // The rank list reaches the database with the Old Testament after everyone.
    const ranks = values(listQuery());
    expect(ranks).toContain("saint-blessed-virgin-mary");
    expect(ranks).toContain("saint-elijah");
    expect(ranks).toContain(1_000_000);
    expect(ranks).toContain(30);
    // Offset of page two.
    expect(listQuery().values.at(-1)).toBe(30);
    expect(listQuery().values.at(-2)).toBe(30);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("hides a duplicate from the rows and the count, but only when its canonical is live", async () => {
    const page = await listPublishedPage("SAINT", { order: "saints", pageSize: 30 });
    for (const sql of [listQuery(), countQuery()]) {
      expect(textOf(sql)).toContain('"slug" <> ALL(');
      // The array that is not the rank list, which names everyone.
      const hidden = sql.values.find(
        (v) =>
          Array.isArray(v) &&
          (v as string[]).includes("saint-john-the-evangelist") &&
          !(v as string[]).includes("saint-joseph"),
      ) as string[];
      expect(hidden).toEqual(["saint-john-the-evangelist", "saint-jude-the-apostle"]);
      // A canonical record that is not published leaves its duplicate on the list.
      expect(hidden).not.toContain("saint-mother-teresa");
    }
    // The page count is honest: it is the count of the same WHERE clause.
    expect(page.total).toBe(100);
    expect(page.pageCount).toBe(4);
    expect(page.items[0]?.href).toBe("/saints/saint-joseph");
  });

  it("hides nothing when the check for live records fails", async () => {
    findMany.mockRejectedValue(new Error("no database"));
    const page = await listPublishedPage("SAINT", { order: "saints" });
    expect(page.items).toHaveLength(1);
    const hidden = countQuery().values.find((v) => Array.isArray(v) && v.length === 0);
    expect(hidden).toEqual([]);
  });

  it("keeps the category filter", async () => {
    await listPublishedPage("SAINT", { order: "saints", subtype: ["apostle", "evangelist"] });
    for (const sql of [listQuery(), countQuery()]) {
      expect(textOf(sql)).toContain('"subtype" = ANY(');
      expect(sql.values).toContainEqual(["apostle", "evangelist"]);
    }
  });

  it("never asks Prisma's orderBy for it", async () => {
    await listPublishedPage("SAINT", { order: "saints" });
    expect(count).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ select: { slug: true } });
  });

  it("orders a search by relevance, then the list's order, without the duplicates", async () => {
    await listPublishedPage("SAINT", { order: "saints", q: "john" });
    const text = textOf(listQuery());
    expect(text).toContain("LEFT JOIN unnest(");
    expect(text).toContain('"rank" DESC,');
    expect(text.indexOf('"rank" DESC')).toBeLessThan(text.indexOf('"listRank" ASC NULLS LAST'));
    // A saint the list names keeps her place ahead of the closest match.
    expect(text.indexOf('THEN "listRank" END')).toBeLessThan(text.indexOf('"rank" DESC'));
    expect(values(listQuery())).toContain(String.raw`\yjohn\y`);
    for (const sql of [listQuery(), countQuery()]) {
      expect(textOf(sql)).toContain('"slug" <> ALL(');
    }
  });

  it("lets a hidden record's name lead to the saint, ahead of the rest when named whole", async () => {
    findMany.mockResolvedValue([
      { slug: "saint-john-the-apostle", title: "John the Apostle" },
      { slug: "saint-john-the-evangelist", title: "John the Evangelist" },
    ]);
    await listPublishedPage("SAINT", { order: "saints", q: "john the evangelist" });
    for (const sql of [listQuery(), countQuery()]) {
      expect(sql.values).toContainEqual(["saint-john-the-apostle"]);
    }
    expect(textOf(listQuery())).toMatch(/\+ CASE WHEN .*"slug" = ANY\(.*THEN 3 ELSE 0 END/s);
  });

  it("leaves a name out of it when a word typed is not in that name", async () => {
    findMany.mockResolvedValue([
      { slug: "saint-john-the-apostle", title: "John the Apostle" },
      { slug: "saint-john-the-evangelist", title: "John the Evangelist" },
    ]);
    await listPublishedPage("SAINT", { order: "saints", q: "john of god" });
    expect(countQuery().values).not.toContainEqual(["saint-john-the-apostle"]);
  });

  it.each(["st peter", "St. Peter", "saint peter"])(
    "reads %s as Saint Peter when it puts the saints the list names first",
    async (q) => {
      await listPublishedPage("SAINT", { order: "saints", q });
      const wanted = String.raw`\y(?:(?:saint|st\.?) )?peter\y`;
      const patterns = values(listQuery()).filter((value) => typeof value === "string");
      expect(patterns.map((value) => (value as string).toLowerCase())).toContain(wanted);
    },
  );

  it("shows the last page of a saint list that ends before the page asked for", async () => {
    database({ total: 40 });
    const page = await listPublishedPage("SAINT", { order: "saints", page: 54, pageSize: 36 });
    expect(page.page).toBe(2);
    expect(values(queries().at(-1)!)).toContain(36);
  });

  it("leaves the search of every other order as it was", async () => {
    await listPublishedPage("SAINT", { order: "title", q: "john" });
    const text = textOf(listQuery());
    expect(text).toContain("ORDER BY");
    expect(text).not.toContain("unnest(");
    expect(text).not.toContain('"listRank"');
    expect(text).not.toContain('"slug" <> ALL(');
  });

  it("keeps the order on the fallback search of a database with no search vector", async () => {
    database({ vector: false, total: 3 });
    const page = await listPublishedPage("SAINT", { order: "saints", q: "john of god" });
    const text = textOf(listQuery());
    expect(text).toContain("LEFT JOIN unnest(");
    expect(text).toContain('"title" ILIKE');
    expect(text).toContain('"slug" <> ALL(');
    expect(page.total).toBe(3);
  });

  it("leaves every other order to Prisma", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await listPublishedPage("SAINT", { order: "chronological" });
    expect(queries()).toHaveLength(0);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: [{ sortYear: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    });
  });
});

describe("listSaintsForFeast", () => {
  it("shows the same person once when both records keep one feast", async () => {
    const row = (slug: string, title: string) => ({
      id: slug,
      checklistItemId: slug,
      contentType: "SAINT",
      slug,
      title,
      subtitle: "",
      payload: { slug },
      authorityLevel: "VATICAN",
      version: 1,
      publishedAt: new Date("2026-01-01"),
    });
    findMany.mockResolvedValue([
      row("saint-john-the-evangelist", "John the Evangelist"),
      row("saint-john-the-apostle", "John the Apostle"),
      row("saint-fabiola", "Fabiola"),
    ]);
    const saints = await listSaintsForFeast(12, 27);
    expect(saints.map((s) => s.slug)).toEqual(["saint-john-the-apostle", "saint-fabiola"]);
  });
});
