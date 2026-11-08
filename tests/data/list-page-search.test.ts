/**
 * Searching one content type in SQL (src/lib/data/published.ts).
 *
 * The list pages whose types grow without bound — /saints, /litanies,
 * /parishes — search in the database, a page at a time, inside their filter.
 * What is pinned here is the query the data layer builds: the type and subtype
 * stay in the WHERE clause, the search vector does the matching when the
 * database has it (with a plain predicate when it does not), the best match
 * comes first, and a parish is found by its name, its city or its postal code.
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
import { accentBlindPattern } from "@/lib/content-shared/parish";
import { listParishPage, listPublishedPage, toListTsQueryText } from "@/lib/data/published";

type Sql = { strings?: string[]; values: unknown[] };
const textOf = (sql: Sql): string => (sql.strings ?? []).join(" ? ");

/** The raw queries issued after the capability probe. */
const searchCalls = () =>
  queryRaw.mock.calls
    .map((c) => c[0] as Sql)
    .filter((sql) => !textOf(sql).includes("information_schema.columns"));

/** A database with (or without) the search vector and pg_trgm. */
function withCapabilities(vector: boolean, trigram = vector) {
  queryRaw.mockImplementation((sql: Sql) => {
    const text = textOf(sql);
    if (text.includes("information_schema.columns")) {
      return Promise.resolve([{ vector, trigram }]);
    }
    if (text.includes("count(*)")) return Promise.resolve([{ total: 42n }]);
    return Promise.resolve([
      {
        id: "s1",
        contentType: "SAINT",
        slug: "francis-of-assisi",
        title: "St. Francis of Assisi",
        subtitle: "Religious founder, patron of animals",
        subtype: "founder",
        rank: 4.2,
      },
    ]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  memoClear();
});

describe("toListTsQueryText", () => {
  it("requires every word, prefix-matches each, and treats Saint and St. as one word", () => {
    expect(toListTsQueryText("fran assisi")).toBe("fran:* & assisi:*");
    expect(toListTsQueryText("Saint Joseph")).toBe("(saint | st) & Joseph:*");
    expect(toListTsQueryText("St. Peter's")).toBe("(saint | st) & Peters:*");
    expect(toListTsQueryText("our-father")).toBe("our:* & father:*");
  });

  it("lets nothing but letters and digits reach to_tsquery", () => {
    expect(toListTsQueryText("mary & !joseph:* | (x)")).toBe("mary:* & joseph:* & x:*");
    expect(toListTsQueryText("!!!")).toBe("");
  });
});

describe("listPublishedPage with a search", () => {
  it("leaves the plain, unsearched page exactly as it was", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await listPublishedPage("SAINT", { q: "   " });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("searches the type in SQL with the search vector, inside the chosen subtypes", async () => {
    withCapabilities(true);
    const page = await listPublishedPage("SAINT", {
      q: "francis",
      subtype: ["religious", "founder"],
      order: "chronological",
      page: 2,
      pageSize: 30,
    });

    const [countSql, listSql] = searchCalls();
    for (const sql of [countSql!, listSql!]) {
      const text = textOf(sql);
      expect(text).toContain('"contentType" = ');
      expect(text).toContain('"isPublished"');
      expect(text).toContain('"searchVector" @@');
      expect(text).toContain('"subtype" = ANY');
      expect(sql.values).toContain("SAINT");
      expect(sql.values).toEqual(expect.arrayContaining([["religious", "founder"]]));
      expect(sql.values).toContain("francis:*");
      expect(sql.values).toContain("%francis%");
    }
    // Best match first, then the list's own (chronological) order; one page.
    const list = textOf(listSql!);
    expect(list).toMatch(/ORDER BY "rank" DESC, "sortYear" ASC NULLS LAST, "title" ASC/);
    expect(list).toContain("LIMIT");
    expect(listSql!.values).toContain(30); // offset of page 2
    // Never the payload: the projection the list pages render.
    expect(list).not.toMatch(/SELECT[^]*"payload"[^]*FROM/);

    expect(page.total).toBe(42);
    expect(page.pageCount).toBe(2);
    expect(page.items[0]).toMatchObject({
      title: "St. Francis of Assisi",
      href: "/saints/francis-of-assisi",
    });
  });

  it("lets a typo match where pg_trgm exists", async () => {
    withCapabilities(true, true);
    await listPublishedPage("SAINT", { q: "Aquinis" });
    expect(textOf(searchCalls()[0]!)).toContain('"title" %');
  });

  it("escapes LIKE wildcards in what the reader typed", async () => {
    withCapabilities(true);
    await listPublishedPage("PRAYER", { q: "100%_sure", subtype: "litany" });
    expect(searchCalls()[0]!.values).toContain("%100\\%\\_sure%");
  });

  it("reads st and saint as one word, whichever the reader typed", () => {
    expect(toListTsQueryText("st peter")).toBe("(saint | st) & peter:*");
    expect(toListTsQueryText("saint peter")).toBe("(saint | st) & peter:*");
  });

  it("falls back to a plain every-word predicate on a database without the vector", async () => {
    withCapabilities(false);
    count.mockResolvedValue(3);
    findMany.mockResolvedValue([]);
    const page = await listPublishedPage("PRAYER", { q: "litany loreto", subtype: "litany" });

    const args = findMany.mock.calls[0][0] as {
      where: { contentType: string; subtype: unknown; AND: Array<{ OR: unknown[] }> };
      orderBy: unknown;
    };
    expect(args.where.contentType).toBe("PRAYER");
    expect(args.where.subtype).toEqual({ in: ["litany"] });
    expect(args.where.AND).toHaveLength(2);
    expect(args.where.AND[0]!.OR).toEqual([
      { title: { contains: "litany", mode: "insensitive" } },
      { subtitle: { contains: "litany", mode: "insensitive" } },
    ]);
    expect(args.orderBy).toEqual([{ title: "asc" }]);
    expect(page.total).toBe(3);
  });

  it("falls back the same way when the indexed query fails", async () => {
    queryRaw.mockImplementation((sql: Sql) =>
      textOf(sql).includes("information_schema.columns")
        ? Promise.resolve([{ vector: true, trigram: false }])
        : Promise.reject(new Error("syntax error in tsquery")),
    );
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await expect(listPublishedPage("SAINT", { q: "mary" })).resolves.toMatchObject({ total: 0 });
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe("listParishPage with a search", () => {
  beforeEach(() => {
    queryRaw.mockResolvedValue([{ total: 0n }]);
  });

  const countSql = () => queryRaw.mock.calls[0]![0] as Sql;

  it("finds a parish by its name or by its city, state or country", async () => {
    await listParishPage({ q: "st mary chicago" });
    const sql = countSql();
    const text = textOf(sql);
    expect(text).toContain('"title" ~*');
    expect(text).toContain('"region" ~*');
    expect(sql.values).toEqual(
      expect.arrayContaining([accentBlindPattern("mary"), accentBlindPattern("chicago")]),
    );
    // "St" is matched as a whole word (or "Saint"), not as any s-t in a name.
    expect(text).toContain("'%saint%'");
    expect(text).toContain("st([^[:alpha:]]|$)");
    // No digits in the query: the payload is never read.
    expect(text).not.toContain("postalCode");
  });

  it("finds a parish by its postal code, word by word or as typed", async () => {
    await listParishPage({ q: "SW1A 1AA" });
    const sql = countSql();
    expect(textOf(sql)).toContain("payload->>'postalCode'");
    expect(sql.values).toEqual(expect.arrayContaining(["SW1A%", "SW1A 1AA%"]));
  });

  it("lists the parishes whose name matches before those matched by place", async () => {
    await listParishPage({ q: "chicago" });
    const list = queryRaw.mock.calls[1]![0] as Sql;
    expect(textOf(list)).toMatch(
      /ORDER BY CASE WHEN "title" ~\* .* THEN 0 ELSE 1 END, "title" ASC/,
    );
    expect(list.values).toContain(accentBlindPattern("chicago"));
  });

  it("reads the words of a name in a row, for that order", async () => {
    await listParishPage({ q: "St. Mary's" });
    const list = queryRaw.mock.calls[1]![0] as Sql;
    expect(list.values).toContain(
      ["St", "Mary", "s"].map(accentBlindPattern).join("[^[:alnum:]]+"),
    );
  });

  it("matches a word with or without its accents, in the name and the place", async () => {
    await listParishPage({ q: "Krakow" });
    const sql = countSql();
    expect(sql.values).toContain(accentBlindPattern("Krakow"));
  });

  it("keeps a word's accents with it, typed in either form, and its marks in one word", async () => {
    await listParishPage({ q: "Ha\u0300 Ẹ̀kọ́" });
    const sql = countSql();
    expect(sql.values).toEqual(
      expect.arrayContaining([accentBlindPattern("Hà"), accentBlindPattern("Ẹ̀kọ́")]),
    );
  });

  it("keeps the classification filter alongside the search", async () => {
    await listParishPage({ q: "john", class: ["chapel", "oratory"] });
    const sql = countSql();
    expect(textOf(sql)).toContain('"subtype" = ANY');
    expect(sql.values).toEqual(
      expect.arrayContaining([["chapel", "oratory"], accentBlindPattern("john")]),
    );
  });

  it("orders by name when nothing is searched, names in the Latin alphabet first", async () => {
    await listParishPage({});
    const list = queryRaw.mock.calls[1]![0] as Sql;
    expect(textOf(list)).toMatch(
      /ORDER BY CASE WHEN "title" ~ '\^\[A-Za-z\]' THEN 0 ELSE 1 END, "title" ASC/,
    );
    expect(textOf(countSql())).not.toContain("ILIKE");
  });

  it("settles a tie between parishes of one name, so an offset never repeats a row", async () => {
    // Live, "sacred heart" repeated 12 rows in its first 180 and lost as many.
    await listParishPage({});
    expect(textOf(queryRaw.mock.calls[1]![0] as Sql)).toMatch(/END, "title" ASC, "id" ASC/);
    queryRaw.mockClear();
    await listParishPage({ q: "sacred heart" });
    expect(textOf(queryRaw.mock.calls[1]![0] as Sql)).toMatch(
      /ORDER BY CASE .* END, "title" ASC, "id" ASC/,
    );
  });
});
