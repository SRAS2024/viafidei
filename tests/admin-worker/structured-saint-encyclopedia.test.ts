/**
 * The Catholic Encyclopedia (1913), read from Wikisource, as a public-domain
 * biography and feast witness for the SAINT ingest. Pinned on real pages
 * saved from en.wikisource.org (`action=parse`, wikitext + rendered HTML):
 * St. Ita, Pope St. Agatho (text transcluded from the scans, so the wikitext
 * has none), St. Eugendus, Gregory Bæticus, Pope St. Symmachus and The Martyrs
 * of Gorkum (an article on a group); and on real citation markup cut from
 * English Wikipedia articles.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  catholicEncyclopediaBiography,
  catholicEncyclopediaFeastDays,
  catholicEncyclopediaFeastVerdict,
  catholicEncyclopediaNamesSubject,
  catholicEncyclopediaRefsIn,
  catholicEncyclopediaTitle,
  catholicEncyclopediaUrl,
  citedArticleTitle,
  newAdventUrl,
  newAdventVolume,
  parseCatholicEncyclopediaPage,
  resolveCatholicEncyclopediaArticle,
  subjectNameWords,
} from "@/lib/admin-worker/structured/catholic-encyclopedia";
import { resetWikimediaQueue, USER_AGENT } from "@/lib/admin-worker/structured/http";
import { saintHydrationSparql } from "@/lib/admin-worker/structured/ingestors";
import { parseSaintFacts } from "@/lib/admin-worker/structured/saint-facts";

const FIXTURES = path.join(__dirname, "fixtures", "saint-pd");

interface ParseFixture {
  parse: { title: string; text: string; wikitext: string };
}
function page(name: string): ParseFixture {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8")) as ParseFixture;
}
function article(name: string) {
  const p = page(name).parse;
  return parseCatholicEncyclopediaPage({
    title: p.title.replace("Catholic Encyclopedia (1913)/", ""),
    wikitext: p.wikitext,
    html: p.text,
  });
}

describe("one Encyclopedia page", () => {
  it("reads the header and the text of an inline page (St. Ita)", () => {
    const ita = article("ce-st-ita.json");
    expect(ita.url).toBe("https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/St._Ita");
    expect(ita.volume).toBe(8);
    expect(ita.wikipedia).toBe("Íte of Killeedy");
    // The signature is a paragraph, but never prose.
    expect(ita.paragraphs.at(-1)).toBe("W. H. Grattan-Flood.");
    const bio = catholicEncyclopediaBiography(ita)!;
    expect(bio).toMatch(
      /^Saint Ita, called the "Brigid of Munster"; b\. in the present County of Waterford/,
    );
    expect(bio).not.toContain("Grattan-Flood");
  });

  it("reads a page whose text is transcluded from the scans (Pope St. Agatho)", () => {
    const p = page("ce-pope-st-agatho.json").parse;
    expect(p.wikitext).toContain("<pages index=");
    const agatho = article("ce-pope-st-agatho.json");
    expect(agatho.volume).toBe(1);
    // "From volume 1 of the work." is the header's note, not the article.
    expect(agatho.paragraphs.join(" ")).not.toContain("From volume 1 of the work");
    expect(catholicEncyclopediaBiography(agatho)).toMatch(
      /^Agatho, Saint, Pope, b\. towards the end/,
    );
  });

  it("cuts a long opening on a sentence, never on an abbreviation", () => {
    const bio = catholicEncyclopediaBiography(article("ce-gregory-baeticus.json"))!;
    expect(bio.length).toBeLessThanOrEqual(1500);
    expect(bio).toMatch(/^Gregory Bæticus, Bishop of Elvira/);
    expect(bio).toMatch(/\.$/);
    expect(bio).not.toMatch(/\b(?:St|b|d|cf)\.$/);
  });
});

describe("the quoted text must be about the saint", () => {
  it("refuses an article on a GROUP whose opening never names the saint", () => {
    // Wikidata's Catholic Encyclopedia ID for Andrew Wouters (06651c) is "The
    // Martyrs of Gorkum", which opens on the year 1572, not on him.
    const gorkum = article("ce-martyrs-of-gorkum.json");
    expect(gorkum.volume).toBe(6);
    const text = catholicEncyclopediaBiography(gorkum)!;
    expect(text).toMatch(/^The year 1572, Luther and Calvin had already wrested from the Church/);
    expect(
      catholicEncyclopediaNamesSubject({
        article: gorkum,
        text,
        label: "Andrew Wouters",
        wikipediaTitle: "Andrew_Wouters",
      }),
    ).toBe(false);
  });

  it("accepts the saint's own article, under another spelling too", () => {
    const ita = article("ce-st-ita.json");
    const text = catholicEncyclopediaBiography(ita)!;
    // The Wikisource header links the saint's English article…
    expect(
      catholicEncyclopediaNamesSubject({
        article: ita,
        text,
        label: "Íte of Killeedy",
        wikipediaTitle: "%C3%8Dte_of_Killeedy",
      }),
    ).toBe(true);
    // …and without it, "Killeedy" in the text names her.
    expect(
      catholicEncyclopediaNamesSubject({
        article: ita,
        text,
        label: "Íte of Killeedy",
        wikipediaTitle: null,
      }),
    ).toBe(true);
    const agatho = article("ce-pope-st-agatho.json");
    expect(
      catholicEncyclopediaNamesSubject({
        article: agatho,
        text: catholicEncyclopediaBiography(agatho)!,
        label: "Pope Agatho",
        wikipediaTitle: null,
      }),
    ).toBe(true);
    // "St. Ceolfrid" (the 1913 spelling) for Ceolfrith: the first five letters agree.
    expect(
      catholicEncyclopediaNamesSubject({
        article: { title: "St. Ceolfrid", wikipedia: null },
        text: "Benedictine monk, Abbot of Wearmouth and Jarrow, b. 642, place of birth not known.",
        label: "Ceolfrith",
        wikipediaTitle: "Ceolfrith",
      }),
    ).toBe(true);
  });
});

describe("explicit feast statements", () => {
  const names = (a: ReturnType<typeof article>, label: string) => subjectNameWords(a.title, label);

  it("reads the subject's own feast ('the feast of St. Ita, which is kept on 15 January')", () => {
    const ita = article("ce-st-ita.json");
    expect(catholicEncyclopediaFeastDays(ita, names(ita, "Íte of Killeedy"))).toEqual(["01-15"]);
    expect(catholicEncyclopediaFeastVerdict(ita, "01-15", names(ita, "Íte of Killeedy"))).toEqual({
      kind: "corroborated",
    });
    // Another Wikidata day is contradicted by the article.
    expect(catholicEncyclopediaFeastVerdict(ita, "01-14", names(ita, "Íte of Killeedy"))).toEqual({
      kind: "contradicted",
      days: ["01-15"],
    });
  });

  it("CONTRADICTS a death date given as the feast (St. Eugendus: Wikidata 1 January)", () => {
    // "The feast of St. Eugendus was at first transferred to January 2; in the
    // Dioceses of Besancon and Saint Claude it is now celebrated on January 4."
    // "d. January 1, 510" is an event (a year follows), never a feast.
    const eugendus = article("ce-st-eugendus.json");
    expect(catholicEncyclopediaFeastDays(eugendus, names(eugendus, "Eugendus"))).toEqual([
      "01-02",
      "01-04",
    ]);
    expect(
      catholicEncyclopediaFeastVerdict(eugendus, "01-01", names(eugendus, "Eugendus")).kind,
    ).toBe("contradicted");
    // Wikidata's day among several stated ones is ambiguous, not corroborated.
    expect(
      catholicEncyclopediaFeastVerdict(eugendus, "01-04", names(eugendus, "Eugendus")).kind,
    ).toBe("ambiguous");
  });

  it("corroborates 'his feast being celebrated on 24 April' (Gregory of Elvira)", () => {
    const gregory = article("ce-gregory-baeticus.json");
    expect(
      catholicEncyclopediaFeastVerdict(gregory, "04-24", names(gregory, "Gregory of Elvira")),
    ).toEqual({
      kind: "corroborated",
    });
  });

  it("does not read another feast as the subject's (Symmachus 'celebrated Easter on 25 March')", () => {
    const symmachus = article("ce-pope-st-symmachus.json");
    expect(catholicEncyclopediaFeastDays(symmachus, names(symmachus, "Symmachus"))).toEqual([]);
    expect(
      catholicEncyclopediaFeastVerdict(symmachus, "07-19", names(symmachus, "Symmachus")).kind,
    ).toBe("silent");
    // And a page that states no feast at all is silent.
    const agatho = article("ce-pope-st-agatho.json");
    expect(catholicEncyclopediaFeastVerdict(agatho, "01-10", names(agatho, "Agatho")).kind).toBe(
      "silent",
    );
  });
});

describe("finding the article from an English Wikipedia article's citations", () => {
  const cited = readFileSync(path.join(FIXTURES, "enwiki-ce-citations.txt"), "utf8");

  it("reads every form the articles use, keeping a New Advent ID", () => {
    expect(catholicEncyclopediaRefsIn(cited)).toEqual([
      { title: "Pope Liberius", newAdventId: "09217a" },
      { title: "Abdication" },
      { title: "St. Leonard of Port Maurice", newAdventId: "09178c" },
      { title: "St. Ceolfrid" },
      { title: "St. Margaret Ward", newAdventId: "15551b" },
      { title: "St. Wolstan", newAdventId: "15687a" },
    ]);
  });

  it("reads a citation's title, never the work's name", () => {
    expect(
      citedArticleTitle('Thurston, Herbert. "St. Alfwold." The Catholic Encyclopedia. Vol. 1.'),
    ).toBe("St. Alfwold");
    expect(citedArticleTitle("CATHOLIC ENCYCLOPEDIA: Pope Liberius")).toBe("Pope Liberius");
    expect(citedArticleTitle("Pope Celestine IV on Catholic Encyclopedia")).toBe(
      "Pope Celestine IV",
    );
    expect(citedArticleTitle("The Catholic Encyclopedia")).toBeNull();
    // The website's name is no article: nothing to read on Wikisource.
    expect(citedArticleTitle("New Advent")).toBeNull();
    expect(
      catholicEncyclopediaRefsIn(
        "<ref>[https://www.newadvent.org/cathen/04491b.htm New Advent]</ref>",
      ),
    ).toEqual([]);
  });

  it("maps identifiers and URLs", () => {
    expect(newAdventVolume("08201c")).toBe(8);
    expect(newAdventUrl("08201c")).toBe("https://www.newadvent.org/cathen/08201c.htm");
    expect(newAdventUrl("not-an-id")).toBeNull();
    expect(catholicEncyclopediaUrl("Ven. César de Bus")).toBe(
      "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/Ven._C%C3%A9sar_de_Bus",
    );
    expect(
      catholicEncyclopediaTitle(
        "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/Ven._C%C3%A9sar_de_Bus",
      ),
    ).toBe("Ven. César de Bus");
    expect(catholicEncyclopediaTitle("https://en.wikipedia.org/wiki/Ita")).toBeNull();
  });
});

describe("resolving the article (Wikisource answered from saved pages)", () => {
  const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
  let savedSkip: string | undefined;
  const realFetch = global.fetch;
  const requested: Array<{ url: string; agent: string }> = [];

  beforeEach(() => {
    savedSkip = process.env[SKIP];
    delete process.env[SKIP];
    resetWikimediaQueue();
    requested.length = 0;
    global.fetch = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      requested.push({ url: String(url), agent: init?.headers?.["User-Agent"] ?? "" });
      const title = decodeURIComponent(String(url).split("&page=")[1] ?? "");
      const body =
        title === "Catholic Encyclopedia (1913)/St. Ita"
          ? page("ce-st-ita.json")
          : { error: { code: "missingtitle" } };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
    }) as unknown as typeof global.fetch;
  });
  afterEach(() => {
    if (savedSkip === undefined) delete process.env[SKIP];
    else process.env[SKIP] = savedSkip;
    global.fetch = realFetch;
    resetWikimediaQueue();
  });

  it("reads the page Wikidata names, from Wikisource, with the worker's User-Agent", async () => {
    const a = await resolveCatholicEncyclopediaArticle({
      wikisourceUrls: ["https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/St._Ita"],
      newAdventIds: [],
      refs: [],
      wikipediaTitle: null,
    });
    expect(a?.title).toBe("St. Ita");
    expect(requested).toHaveLength(1);
    expect(requested[0].url).toMatch(/^https:\/\/en\.wikisource\.org\/w\/api\.php\?action=parse/);
    expect(requested[0].agent).toBe(USER_AGENT);
  });

  it("accepts a cited page only in the volume of the saint's Catholic Encyclopedia ID", async () => {
    const refs = [{ title: "St. Ita" }];
    const ok = await resolveCatholicEncyclopediaArticle({
      wikisourceUrls: [],
      newAdventIds: ["08201c"],
      refs,
      wikipediaTitle: "%C3%8Dte_of_Killeedy",
    });
    expect(ok?.title).toBe("St. Ita");
    // Volume 9 is another article: the page is not the saint's.
    const wrongVolume = await resolveCatholicEncyclopediaArticle({
      wikisourceUrls: [],
      newAdventIds: ["09201c"],
      refs,
      wikipediaTitle: "Íte_of_Killeedy",
    });
    expect(wrongVolume).toBeNull();
  });

  it("refuses a page whose Wikisource header links another Wikipedia article", async () => {
    const a = await resolveCatholicEncyclopediaArticle({
      wikisourceUrls: [],
      newAdventIds: ["08201c"],
      refs: [{ title: "St. Ita" }],
      wikipediaTitle: "Brigid_of_Kildare",
    });
    expect(a).toBeNull();
  });

  it("never follows a citation of ANOTHER New Advent ID, and needs a P3241 to follow any", async () => {
    expect(
      await resolveCatholicEncyclopediaArticle({
        wikisourceUrls: [],
        newAdventIds: ["08201c"],
        refs: [{ title: "St. Ita", newAdventId: "08999z" }],
        wikipediaTitle: null,
      }),
    ).toBeNull();
    expect(
      await resolveCatholicEncyclopediaArticle({
        wikisourceUrls: [],
        newAdventIds: [],
        refs: [{ title: "St. Ita" }],
        wikipediaTitle: null,
      }),
    ).toBeNull();
    expect(requested).toHaveLength(0);
  });
});

describe("the hydration query brings the Encyclopedia links", () => {
  it("projects the Catholic Encyclopedia IDs and Wikisource articles", () => {
    const q = saintHydrationSparql(["http://www.wikidata.org/entity/Q1288349"])!;
    expect(q).toContain("AS ?ceIds");
    expect(q).toContain("AS ?ceArts");
    expect(q).toContain("OPTIONAL { ?s wdt:P3241 ?ceId . }");
    expect(q).toContain("?ceItem wdt:P921 ?s ; wdt:P1433 wd:Q302556");
    expect(q).toContain("schema:isPartOf <https://en.wikisource.org/>");
  });

  it("parses them, keeping only Encyclopedia pages and well-formed IDs", () => {
    const facts = parseSaintFacts({
      s: { type: "uri", value: "http://www.wikidata.org/entity/Q1288349" },
      label: { type: "literal", value: "Íte of Killeedy" },
      ceIds: { type: "literal", value: "08201C||bogus" },
      ceArts: {
        type: "literal",
        value:
          "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/St._Ita||https://en.wikisource.org/wiki/Other_work/Ita",
      },
    })!;
    expect(facts.ceIds).toEqual(["08201c"]);
    expect(facts.ceArticles).toEqual([
      "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/St._Ita",
    ]);
  });
});
