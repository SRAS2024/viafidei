/**
 * Search (src/lib/data/published.ts).
 *
 * The indexed path needs a real Postgres, so what is pinned here is
 * everything that can go wrong WITHOUT one: the tsquery the data layer builds,
 * that a database with no searchVector column degrades to the old predicate
 * instead of throwing, that results carry human type labels rather than raw
 * enums, and that suggestions are balanced per group (the old implementation
 * took the alphabetically first 120 matches, so small groups never appeared).
 */
import { ChecklistContentType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();
const count = vi.fn();
const queryRaw = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: {
      findMany: (...args: unknown[]) => findMany(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
      count: (...args: unknown[]) => count(...args),
      groupBy: vi.fn(),
    },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { memoClear } from "@/lib/cache/memo";
import {
  translateTypeLabel,
  typeLabelTranslations,
} from "@/lib/content-shared/content-type-labels";
import { createTranslator } from "@/lib/i18n/translator";
import {
  contentTypeLabel,
  searchPublished,
  searchPublishedPage,
  suggestPublished,
  toTsQueryText,
} from "@/lib/data/published";

/** The capability probe is the first raw query every search makes. */
function withCapabilities(vector: boolean, trigram = vector) {
  queryRaw.mockImplementation((sql: { strings?: string[] }) => {
    const text = (sql.strings ?? []).join(" ");
    if (text.includes("information_schema.columns")) {
      return Promise.resolve([{ vector, trigram }]);
    }
    return Promise.resolve([]);
  });
}

/** Every parameter value the data layer interpolated into a raw query. */
function rawValues(): unknown[] {
  return queryRaw.mock.calls.flatMap((c) => (c[0] as { values?: unknown[] })?.values ?? []);
}

/** The queries for rows to show, leaving out the lookup of which saints are duplicates. */
function rowQueries(): Array<Record<string, unknown>> {
  return findMany.mock.calls
    .map(([args]) => args as Record<string, unknown>)
    .filter((args) => "take" in args);
}

/** The SQL text of every raw query the data layer issued. */
function rawSql(): string {
  return queryRaw.mock.calls
    .map((c) => ((c[0] as { strings?: string[] })?.strings ?? []).join(" "))
    .join("\n");
}

beforeEach(() => {
  vi.clearAllMocks();
  memoClear();
});

describe("a search with no letters or digits in it", () => {
  it.each(["%", "_", "%%", "__", "!!", "-", "%_%"])("finds nothing for %s", async (q) => {
    withCapabilities(true);
    const results = await searchPublishedPage(q);
    expect(results.total).toBe(0);
    expect(results.hits).toEqual([]);
    // It never reaches a pattern, where these two mean "anything".
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("asks nothing of the database for suggestions either", async () => {
    withCapabilities(true);
    await expect(suggestPublished("%%")).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe("LIKE wildcards in a search with words in it", () => {
  it("are literal in the indexed path's title prefix", async () => {
    withCapabilities(true);
    await searchPublishedPage("50%_off");
    expect(rawValues()).toContain("50\\%\\_off%");
    expect(rawValues()).not.toContain("50%_off%");
  });

  it("are literal in the fallback, for the rows and the count alike", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await searchPublishedPage("50%_off");
    for (const args of [rowQueries()[0]!, count.mock.calls[0]![0]]) {
      expect((args as { where: { OR: unknown[] } }).where.OR).toEqual([
        { title: { contains: "50\\%\\_off", mode: "insensitive" } },
        { slug: { contains: "50\\%\\_off", mode: "insensitive" } },
      ]);
    }
  });
});

describe("a saint published twice", () => {
  /** The canonical records are live, so every duplicate of them is hidden. */
  function withLiveCanonicals() {
    findMany.mockImplementation(async (args: { take?: number }) =>
      args.take === undefined
        ? [
            { slug: "saint-dismas", title: "Saint Dismas, the Good Thief" },
            { slug: "saint-penitent-thief", title: "Penitent Thief" },
            { slug: "saint-peter-liu", title: "Saint Peter Liu" },
          ]
        : [],
    );
  }

  /** Every array of slugs handed to the SQL. */
  const slugLists = () => rawValues().filter(Array.isArray) as string[][];

  it("is left out of a search, its count and its groups", async () => {
    withCapabilities(true);
    withLiveCanonicals();
    await searchPublishedPage("good thief");
    expect(rawSql()).toContain("\"contentType\" = 'SAINT'");
    expect(rawSql()).toContain('"slug" = ANY(');
    // The filter and the rows use one predicate: a count that held him would lie.
    const hidden = slugLists().filter((slugs) => slugs.includes("saint-penitent-thief"));
    expect(hidden.length).toBeGreaterThanOrEqual(2);
    for (const slugs of hidden) expect(slugs).toContain("saint-peter-lieou");
  });

  it("still leads a search for his name to the saint, first of all", async () => {
    withCapabilities(true);
    withLiveCanonicals();
    await searchPublishedPage("Penitent Thief");
    expect(slugLists().filter((slugs) => slugs.includes("saint-dismas")).length).toBeGreaterThan(0);
    // Named whole, he leads: that is the third list, inside the ranking.
    expect(rawSql()).toMatch(/\+ CASE WHEN .*"slug" = ANY\(.*THEN 3 ELSE 0 END/s);
  });

  it("is reached by part of his name, as it is typed", async () => {
    withCapabilities(true);
    withLiveCanonicals();
    await suggestPublished("penitent th");
    expect(slugLists().some((slugs) => slugs.includes("saint-dismas"))).toBe(true);
  });

  it("is not reached by a word that is not in his name", async () => {
    withCapabilities(true);
    withLiveCanonicals();
    await searchPublishedPage("thieves");
    expect(slugLists().some((slugs) => slugs.includes("saint-dismas"))).toBe(false);
  });

  it("leads the fallback to the saint too", async () => {
    withCapabilities(false);
    withLiveCanonicals();
    count.mockResolvedValue(0);
    await searchPublishedPage("Penitent Thief");
    const { OR } = rowQueries()[0]!.where as { OR: Array<Record<string, unknown>> };
    expect(OR).toContainEqual({ contentType: "SAINT", slug: { in: ["saint-dismas"] } });
  });

  it("is left out of the suggestions", async () => {
    withCapabilities(true);
    withLiveCanonicals();
    await suggestPublished("penitent thief");
    expect(slugLists().some((slugs) => slugs.includes("saint-penitent-thief"))).toBe(true);
  });

  it("is left out of the fallback, for the rows and the count alike", async () => {
    withCapabilities(false);
    withLiveCanonicals();
    count.mockResolvedValue(0);
    await searchPublishedPage("thief");
    for (const args of [rowQueries()[0]!, count.mock.calls[0]![0]]) {
      const { NOT } = (args as { where: { NOT: { contentType: string; slug: { in: string[] } } } })
        .where;
      expect(NOT.contentType).toBe("SAINT");
      expect(NOT.slug.in).toContain("saint-penitent-thief");
    }
  });

  it("is not found by a pasted slug either", async () => {
    withCapabilities(false);
    withLiveCanonicals();
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);
    await searchPublishedPage("saint-penitent-thief");
    const { NOT } = findFirst.mock.calls[0]![0].where as { NOT: { slug: { in: string[] } } };
    expect(NOT.slug.in).toContain("saint-penitent-thief");
  });

  it("stays in search when its better record is withdrawn, so a saint can never vanish", async () => {
    withCapabilities(true);
    findMany.mockResolvedValue([{ slug: "saint-peter-liu", title: "Saint Peter Liu" }]);
    await searchPublishedPage("good thief");
    const hidden = slugLists().filter((slugs) => slugs.includes("saint-peter-lieou"));
    expect(hidden.length).toBeGreaterThan(0);
    for (const slugs of hidden) expect(slugs).not.toContain("saint-penitent-thief");
  });
});

describe("a church's name in search", () => {
  const church = {
    id: "1",
    contentType: "PARISH",
    slug: "saint-rose",
    title: "Saint Rose of Lima Catholic Church;Iglesia Católica Santa Rosa de Lima",
    subtitle: null,
    subtype: "parish",
  };
  const shown = "Saint Rose of Lima Catholic Church (Iglesia Católica Santa Rosa de Lima)";

  it("reads as the directory shows it, in the results and the suggestions", async () => {
    withCapabilities(false);
    findMany.mockImplementation(async (args: { take?: number }) =>
      args.take === undefined ? [] : [church],
    );
    count.mockResolvedValue(1);
    expect((await searchPublishedPage("rose")).hits[0]!.title).toBe(shown);
    memoClear();
    expect((await suggestPublished("rose"))[0]!.label).toBe(shown);
  });
});

describe("a title's whole words in the search's ranking", () => {
  it("reads St. and Saint as one word, and does not require either", async () => {
    withCapabilities(true);
    await searchPublishedPage("st. peter");
    expect(rawValues()).toContain(String.raw`\y(?:(?:saint|st\.?) )?peter\y`);
  });

  it("leaves other words as typed", async () => {
    withCapabilities(true);
    await searchPublishedPage("Hail Mary");
    expect(rawValues()).toContain(String.raw`\yHail Mary\y`);
  });
});

describe("toTsQueryText", () => {
  it("ANDs the words and prefix-matches the last one for autocomplete", () => {
    expect(toTsQueryText("st john")).toBe("st & john:*");
  });

  it("does not prefix-expand when the caller asks for whole words", () => {
    expect(toTsQueryText("st john", false)).toBe("st & john");
  });

  it("treats a pasted slug as words, so 'our-father' finds 'Our Father'", () => {
    expect(toTsQueryText("our-father", false)).toBe("our & father");
  });

  it("drops punctuation entirely — nothing reaches to_tsquery that could break it", () => {
    expect(toTsQueryText("mary & !joseph:*", false)).toBe("mary & joseph");
    expect(toTsQueryText("   ")).toBe("");
    expect(toTsQueryText("!!!")).toBe("");
  });

  it("keeps non-ASCII letters (Ælfheah, Thérèse) rather than stripping them", () => {
    expect(toTsQueryText("Thérèse", false)).toBe("Thérèse");
  });
});

describe("searchPublishedPage without the search column", () => {
  it("falls back to the previous predicate instead of failing", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue([
      {
        id: "1",
        contentType: "MARIAN_TITLE",
        slug: "our-lady-of-guadalupe",
        title: "Our Lady of Guadalupe",
        subtitle: "Patroness of the Americas",
        subtype: null,
      },
    ]);
    count.mockResolvedValue(1);

    const result = await searchPublishedPage("guadalupe");
    expect(result.indexed).toBe(false);
    expect(result.total).toBe(1);
    // Raw enums never reach the page.
    expect(result.hits[0].typeLabel).toBe("Our Lady");
    expect(result.hits[0].href).toBe("/our-lady/our-lady-of-guadalupe");
    expect(result.groups[0].label).toBe("Our Lady");
  });

  it("reports the true total, not the size of the page", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(512);
    const result = await searchPublishedPage("mary", { pageSize: 25 });
    expect(result.total).toBe(512);
    expect(result.pageCount).toBe(Math.ceil(512 / 25));
  });

  it("still resolves a pasted slug that matched nothing as words", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue({
      id: "9",
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
      subtitle: "The Lord's Prayer",
      subtype: null,
    });
    const result = await searchPublishedPage("our-father");
    expect(result.hits.map((h) => h.slug)).toEqual(["our-father"]);
    expect(result.total).toBe(1);
  });

  it("returns nothing for an empty query without querying at all", async () => {
    const result = await searchPublishedPage("   ");
    expect(result.hits).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("searchPublished keeps its (query, limit) signature for the worker's verifier", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue([
      {
        id: "1",
        contentType: "PRAYER",
        slug: "our-father",
        title: "Our Father",
        subtitle: null,
        subtype: null,
      },
    ]);
    count.mockResolvedValue(1);
    const hits = await searchPublished("our father", 50);
    expect(hits.map((h) => h.slug)).toEqual(["our-father"]);
    expect(rowQueries()[0]!.take).toBe(50);
  });
});

describe("searchPublishedPage's groups", () => {
  /** A row of the indexed query, as the raw SQL returns it. */
  const row = (id: string, contentType: string, subtype: string | null = null) => ({
    id,
    contentType,
    slug: `slug-${id}`,
    title: `Title ${id}`,
    subtitle: null,
    subtype,
    rank: 1,
  });

  /** The capability probe, then the count by type, then the page of hits. */
  function withIndexedResults(
    counts: Array<{ contentType: string; subtype: string | null; total: bigint }>,
    hits: unknown[],
  ) {
    queryRaw.mockImplementation((sql: { strings?: string[] }) => {
      const text = (sql.strings ?? []).join(" ");
      if (text.includes("information_schema.columns")) {
        return Promise.resolve([{ vector: true, trigram: true }]);
      }
      return Promise.resolve(text.includes("GROUP BY") ? counts : hits);
    });
  }

  it("says each group's total across all pages, not its rows on this page", async () => {
    withIndexedResults(
      [
        { contentType: "PRAYER", subtype: "marian", total: 20n },
        { contentType: "PRAYER", subtype: "devotional", total: 4n },
        { contentType: "SAINT", subtype: null, total: 5n },
      ],
      [row("1", "PRAYER", "marian"), row("2", "PRAYER", "devotional"), row("3", "SAINT")],
    );
    const result = await searchPublishedPage("rosary", { pageSize: 3 });
    expect(result.total).toBe(29);
    expect(result.pageCount).toBe(10);
    expect(result.groups.map((g) => [g.label, g.items.length, g.total])).toEqual([
      ["Prayer", 2, 24],
      ["Saint", 1, 5],
    ]);
  });

  it("keeps a heading true of every row: a Litany is not filed under a Prayer", async () => {
    // The heading was the first row's label, so whichever came first named them all.
    withIndexedResults(
      [
        { contentType: "PRAYER", subtype: "litany", total: 1n },
        { contentType: "PRAYER", subtype: "marian", total: 2n },
        { contentType: "MARIAN_TITLE", subtype: null, total: 1n },
        { contentType: "APPARITION", subtype: "approved", total: 1n },
      ],
      [
        row("1", "PRAYER", "litany"),
        row("2", "PRAYER", "marian"),
        row("3", "MARIAN_TITLE"),
        row("4", "APPARITION", "approved"),
        row("5", "PRAYER", "marian"),
      ],
    );
    const result = await searchPublishedPage("lourdes");
    expect(
      result.groups.map((g) => [g.label, g.total, g.items.map((item) => item.typeLabel)]),
    ).toEqual([
      ["Litany", 1, ["Litany"]],
      ["Prayer", 2, ["Prayer", "Prayer"]],
      ["Our Lady", 1, ["Our Lady"]],
      ["Apparition", 1, ["Apparition"]],
    ]);
    for (const group of result.groups) {
      for (const item of group.items) expect(item.typeLabel).toBe(group.label);
    }
  });

  it("counts in the one query it already makes, with the same match as the rows", async () => {
    withIndexedResults([], []);
    await searchPublishedPage("rosary");
    const sql = rawSql();
    expect(sql.match(/GROUP BY/g)).toHaveLength(1);
    expect(sql).not.toMatch(/SELECT count\(\*\)::bigint AS total FROM/);
  });

  it("does not claim a total the unindexed path has not counted", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue([row("1", "SAINT"), row("2", "SAINT")]);
    count.mockResolvedValue(40);
    const many = await searchPublishedPage("mary", { pageSize: 2 });
    expect(many.groups[0].total).toBeNull();

    count.mockResolvedValue(2);
    const few = await searchPublishedPage("mary", { pageSize: 25 });
    expect(few.groups[0].total).toBe(2);
  });

  it("counts a pasted slug's one row", async () => {
    withCapabilities(true);
    findFirst.mockResolvedValue(row("9", "PRAYER"));
    const result = await searchPublishedPage("our-father");
    expect(result.total).toBe(1);
    expect(result.groups[0].total).toBe(1);
  });
});

describe("suggestPublished", () => {
  it("ignores queries shorter than two characters", async () => {
    expect(await suggestPublished("m")).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("asks each content type for its own best rows (no group starvation)", async () => {
    withCapabilities(true);
    queryRaw.mockImplementation((sql: { strings?: string[] }) => {
      const text = (sql.strings ?? []).join(" ");
      if (text.includes("information_schema.columns")) {
        return Promise.resolve([{ vector: true, trigram: true }]);
      }
      expect(text).toContain("CROSS JOIN LATERAL");
      return Promise.resolve([
        {
          id: "1",
          contentType: "MARIAN_TITLE",
          slug: "mary-undoer-of-knots",
          title: "Mary, Undoer of Knots",
          subtitle: "A Marian title",
          subtype: null,
          rank: 3,
        },
      ]);
    });
    const suggestions = await suggestPublished("mar", 2);
    expect(suggestions[0]).toMatchObject({
      group: "apparitions",
      label: "Mary, Undoer of Knots",
      typeLabel: "Our Lady",
      href: "/our-lady/mary-undoer-of-knots",
      subtitle: "A Marian title",
    });
  });

  it("caps each group in JS when the indexed path is unavailable", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        id: `s${i}`,
        contentType: "SAINT",
        slug: `saint-${i}`,
        title: `Saint ${i}`,
        subtitle: null,
        subtype: null,
      })).concat([
        {
          id: "p1",
          contentType: "PRAYER",
          slug: "hail-mary",
          title: "Hail Mary",
          subtitle: null,
          subtype: null,
        },
      ]),
    );
    const suggestions = await suggestPublished("mar", 2);
    expect(suggestions.filter((s) => s.group === "saints")).toHaveLength(2);
    // The small group still survives the cap.
    expect(suggestions.some((s) => s.group === "prayers")).toBe(true);
  });
});

describe("the ranking expression the indexed path builds", () => {
  it("sends Postgres a real word-boundary escape, not the letter y", async () => {
    // `\y` is not a JavaScript escape: in a plain template literal it collapses
    // to a bare `y`, so this shipped as the pattern `ymaryy` and the +2 boost
    // never fired for any row. Verified against Postgres: `title ~* 'ymaryy'`
    // is false for "Hail Mary" while `title ~* '\ymary\y'` is true, which is
    // exactly why "Marie-Catherine Troiani" outranked "Hail Mary" for "mary".
    withCapabilities(true);
    await searchPublishedPage("mary");
    const values = rawValues().map(String);
    expect(values).toContain(String.raw`\ymary\y`);
    expect(values).not.toContain("ymaryy");
  });

  it("drops the word-boundary term entirely when the query has no words", async () => {
    withCapabilities(true);
    await searchPublishedPage("!!!");
    expect(
      rawValues()
        .map(String)
        .some((v) => v.includes("\\y")),
    ).toBe(false);
  });
});

describe("searchCapabilities probes the whole mechanism", () => {
  it("requires the trigger as well as the column", async () => {
    // "column exists, trigger does not" leaves every searchVector NULL, so `@@`
    // matches nothing and search goes silently and totally dark while still
    // reporting indexed=true. Probing only the column could not see that.
    withCapabilities(true);
    await searchPublishedPage("mary");
    const sql = rawSql();
    expect(sql).toContain("pg_trigger");
    expect(sql).toContain("PublishedContent_searchVector_tgr");
    expect(sql).toContain("tgisinternal");
    // …and the column probe is scoped to the public schema.
    expect(sql).toContain("table_schema = 'public'");
  });
});

describe("suggestPublished does not double-query on a genuine no-match", () => {
  it("runs the unindexed fallback ONLY when the indexed query failed", async () => {
    // `rows.length === 0` cannot tell "the query threw" from "nothing matched",
    // so every no-match keystroke in the header autocomplete used to pay for
    // the indexed LATERAL query AND a 200-row `contains` scan of the table.
    withCapabilities(true);
    findMany.mockResolvedValue([]);
    const none = await suggestPublished("zzzz", 2);
    expect(none).toEqual([]);
    expect(rowQueries()).toEqual([]);

    // …and a query that actually throws still falls back.
    queryRaw.mockImplementation((sql: { strings?: string[] }) => {
      const text = (sql.strings ?? []).join(" ");
      if (text.includes("information_schema.columns")) {
        return Promise.resolve([{ vector: true, trigram: true }]);
      }
      return Promise.reject(new Error("relation does not exist"));
    });
    memoClear();
    await suggestPublished("zzzz", 2);
    expect(findMany).toHaveBeenCalled();
  });
});

describe("rows tied on rank and title", () => {
  // Two parishes of one name tie on both. Each page's query ordered them its own way,
  // so one showed on two pages and the other on none, behind a count that added up.
  it("are settled by the id in the indexed search", async () => {
    withCapabilities(true);
    await searchPublishedPage("baptism", { page: 2 });
    expect(rawSql()).toMatch(/ORDER BY "rank" DESC, "title" ASC, "id" ASC\s+LIMIT/);
  });

  it("are settled by the id in the fallback", async () => {
    withCapabilities(false);
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await searchPublishedPage("baptism", { page: 2 });
    expect(rowQueries()[0]!.orderBy).toEqual([{ title: "asc" }, { id: "asc" }]);
  });

  it("are settled by the id in the suggestions, per group and overall", async () => {
    withCapabilities(true);
    await suggestPublished("baptism");
    const sql = rawSql();
    expect(sql).toMatch(/ORDER BY "rank" DESC, "title" ASC, "id" ASC\s+LIMIT/);
    expect(sql).toMatch(/ORDER BY s\."rank" DESC, s\."title" ASC, s\."id" ASC/);
  });
});

describe("contentTypeLabel", () => {
  it("has a translation for every label it can return", () => {
    const es = typeLabelTranslations(createTranslator("es"));
    const en = createTranslator("en");
    for (const type of Object.values(ChecklistContentType)) {
      const label = contentTypeLabel(type);
      expect(es[label], type).toBeTruthy();
      // In English it reads as the data layer has it, so nothing changes for this reader.
      expect(translateTypeLabel(label, en), type).toBe(label);
    }
    expect(es[contentTypeLabel("PRAYER", "litany")]).toBe("Letanía");
  });

  it("never returns a raw enum value", () => {
    expect(contentTypeLabel("CHURCH_DOCUMENT")).toBe("Church Document");
    expect(contentTypeLabel("SPIRITUAL_PRACTICE")).toBe("Spiritual Life");
    expect(contentTypeLabel("MARIAN_TITLE")).toBe("Our Lady");
  });

  it("calls a litany a Litany", () => {
    expect(contentTypeLabel("PRAYER", "litany")).toBe("Litany");
    expect(contentTypeLabel("PRAYER", "marian")).toBe("Prayer");
  });
});
