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
    expect((findMany.mock.calls[0][0] as { take: number }).take).toBe(50);
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
    expect(findMany).not.toHaveBeenCalled();

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

describe("contentTypeLabel", () => {
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
