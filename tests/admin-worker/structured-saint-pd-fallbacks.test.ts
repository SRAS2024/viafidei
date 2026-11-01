/**
 * The SAINT mapper's public-domain fallbacks — the Catholic Encyclopedia (1913)
 * and the 1916 Roman Martyrology — wired so the stricter Wikipedia gates stay
 * intact:
 *   - they supply a biography only when there is no English lead (or it is
 *     under the floor), and they are asked before any request only when one
 *     can exist at all;
 *   - they corroborate Wikidata's ONE feast day only when the article states
 *     no feast; an infobox or prose that names another day still refuses, and
 *     so does either source contradicting Wikidata;
 *   - the payload says which source gave the biography and which corroborated
 *     the feast, and cites them.
 *
 * Wikipedia is mocked as in the gate tests; Wikisource answers from pages
 * saved from en.wikisource.org; the Martyrology is the committed day index.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
  fetchIntroForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/structured/wikipedia-infobox", () => ({
  fetchArticleInfobox: vi.fn(async () => ({})),
  fetchArticleSource: vi.fn(),
}));

import { validatePayload } from "@/lib/checklist";
import { resetWikimediaQueue } from "@/lib/admin-worker/structured/http";
import { ingestorFor } from "@/lib/admin-worker/structured/ingestors";
import { mapSourceRowDetailed } from "@/lib/admin-worker/structured/map-row";
import { rejectionOf, type MapResult } from "@/lib/admin-worker/structured/reject";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { fetchArticleSource } from "@/lib/admin-worker/structured/wikipedia-infobox";
import { publicDomainTextSource } from "@/lib/content-shared/public-domain-attribution";
import { wikipediaTextSource } from "@/lib/content-shared/wikipedia-attribution";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedSource = vi.mocked(fetchArticleSource);

const FIXTURES = path.join(__dirname, "fixtures", "saint-pd");
const WIKISOURCE_PAGES: Record<string, string> = {
  "Catholic Encyclopedia (1913)/St. Ita": "ce-st-ita.json",
  "Catholic Encyclopedia (1913)/St. Eugendus": "ce-st-eugendus.json",
  "Catholic Encyclopedia (1913)/Gregory Bæticus": "ce-gregory-baeticus.json",
  "Catholic Encyclopedia (1913)/Martyrs of Gorkum": "ce-martyrs-of-gorkum.json",
};
const CE = "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/";
const RM_URL = "https://archive.org/details/romanmartyrology00cathuoft";

const WD = "http://www.wikidata.org/entity/";
const CATHOLIC_SAINT = `${WD}Q3464126`;
const CATHOLIC_CHURCH = `${WD}Q9592`;

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;
const realFetch = global.fetch;
let wikisourceStatus = 200;
/** Rewrites a served page's HTML (to make reading it fail in a given way). */
let wikisourceHtml: ((html: string) => string) | null = null;
const wikisourceRequests: string[] = [];

beforeEach(() => {
  savedSkip = process.env[SKIP];
  delete process.env[SKIP];
  resetWikimediaQueue();
  wikisourceStatus = 200;
  wikisourceHtml = null;
  wikisourceRequests.length = 0;
  mockedSummary.mockReset();
  mockedSource.mockReset();
  mockedSource.mockResolvedValue({ infobox: {}, prose: "", read: true });
  global.fetch = vi.fn(async (url: string) => {
    const u = String(url);
    if (!u.startsWith("https://en.wikisource.org/w/api.php")) {
      throw new Error(`unexpected request ${u}`);
    }
    wikisourceRequests.push(u);
    if (wikisourceStatus !== 200) {
      return { ok: false, status: wikisourceStatus, headers: { get: () => null } };
    }
    const title = decodeURIComponent(u.split("&page=")[1] ?? "");
    const file = WIKISOURCE_PAGES[title];
    const body = file
      ? JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8"))
      : { error: { code: "missingtitle" } };
    if (file && wikisourceHtml) body.parse.text = wikisourceHtml(body.parse.text);
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  }) as unknown as typeof global.fetch;
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  global.fetch = realFetch;
  resetWikimediaQueue();
  vi.restoreAllMocks();
});

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

function saintMap(r: SparqlBinding): Promise<MapResult> {
  return ingestorFor("SAINT")!.map(r, { reads: { unread: [] } });
}

function payloadOf(result: MapResult): Record<string, unknown> {
  if (rejectionOf(result)) throw new Error(`rejected: ${JSON.stringify(rejectionOf(result))}`);
  return (result as { payload: Record<string, unknown> }).payload;
}

describe("no English article: a public-domain biography where one can exist", () => {
  const MAXIMUS = {
    s: `${WD}Q11766605`,
    label: "Maximus of Riez",
    statuses: CATHOLIC_SAINT,
    feasts: "27 November",
    altArts: "https://fr.wikipedia.org/wiki/Maxime_de_Riez",
  };

  it("publishes from the Martyrology when the French article states no feast", async () => {
    const payload = payloadOf(await saintMap(row(MAXIMUS)));
    expect(payload.biography).toMatch(/^At Riez, in France, St\. Maximus, bishop and confessor/);
    expect(payload).toMatchObject({ feastDay: "11-27", canonizationStatus: "canonized" });
    expect(payload.provenance).toEqual({
      biography: "roman-martyrology-1916",
      biographyUrl: RM_URL,
      biographyDay: "11-27",
      feast: "roman-martyrology-1916",
      feastUrl: RM_URL,
    });
    expect(payload.citations).toEqual([
      "https://www.wikidata.org/wiki/Q11766605",
      "https://fr.wikipedia.org/wiki/Maxime_de_Riez",
      RM_URL,
    ]);
    // The French article was read for the gates; there is no English summary.
    expect(mockedSource).toHaveBeenCalledWith(
      "https://fr.wikipedia.org/wiki/Maxime_de_Riez",
      expect.anything(),
    );
    expect(mockedSummary).not.toHaveBeenCalled();
    expect(validatePayload("SAINT", payload).ok).toBe(true);
  });

  it("still refuses when that article's infobox names another day", async () => {
    mockedSource.mockResolvedValue({ infobox: { fête: "26 novembre" }, prose: "", read: true });
    expect(rejectionOf(await saintMap(row(MAXIMUS)))?.code).toBe("feast_contradicted");
  });

  it("still refuses when that article could not be read", async () => {
    mockedSource.mockResolvedValue({ infobox: {}, prose: "", read: false });
    expect(rejectionOf(await saintMap(row(MAXIMUS)))?.code).toBe("source_read_failed");
  });

  it("publishes a saint with no Wikipedia article at all from the Martyrology", async () => {
    const payload = payloadOf(
      await saintMap(
        row({
          s: `${WD}Q120531725`,
          label: "Stratonicus",
          statuses: CATHOLIC_SAINT,
          feasts: "13 January",
        }),
      ),
    );
    expect(payload.biography).toMatch(/holy martyrs Hermylus and Stratonicus/);
    expect(payload.citations).toEqual(["https://www.wikidata.org/wiki/Q120531725", RM_URL]);
    expect(mockedSource).not.toHaveBeenCalled();
  });

  it("stops before any request when no public-domain text can be tied to the saint", async () => {
    const r = await saintMap(
      row({
        s: `${WD}Q100272960`,
        label: "Carmen García Moyón",
        statuses: `${WD}Q2369287`,
        feasts: "24 January",
        altArts: "https://es.wikipedia.org/wiki/Carmen_Garc%C3%ADa_Moy%C3%B3n",
      }),
    );
    expect(rejectionOf(r)?.code).toBe("biography_unavailable");
    expect(mockedSource).not.toHaveBeenCalled();
    expect(wikisourceRequests).toHaveLength(0);
  });

  it("never takes a stage from nowhere: no article, no P411, no record", async () => {
    const r = await saintMap(
      row({
        s: `${WD}Q120531725`,
        label: "Stratonicus",
        religions: CATHOLIC_CHURCH,
        feasts: "13 January",
      }),
    );
    expect(rejectionOf(r)?.code).toBe("no_wikipedia_article");
    expect(mockedSource).not.toHaveBeenCalled();
  });
});

describe("an English article: the Encyclopedia stands in, never overrides", () => {
  const ITA = {
    s: `${WD}Q1288349`,
    label: "Íte of Killeedy",
    statuses: CATHOLIC_SAINT,
    feasts: "15 January",
    art: "https://en.wikipedia.org/wiki/%C3%8Dte_of_Killeedy",
  };
  const SHORT_LEAD = "Saint Íte of Killeedy was an Irish nun and patron saint of Killeedy.";

  it("takes the biography from the Encyclopedia when the English lead is under the floor", async () => {
    mockedSummary.mockResolvedValue({ extract: SHORT_LEAD, url: ITA.art, lang: "en" });
    mockedSource.mockResolvedValue({ infobox: { feast_day: "15 January" }, prose: "", read: true });
    const payload = payloadOf(await saintMap(row({ ...ITA, ceArts: `${CE}St._Ita` })));
    expect(payload.biography).toMatch(/^Saint Ita, called the "Brigid of Munster"/);
    expect(payload.feastDay).toBe("01-15");
    expect(payload.provenance).toEqual({
      biography: "catholic-encyclopedia-1913",
      biographyUrl: `${CE}St._Ita`,
      biographyTitle: "St. Ita",
      feast: "wikipedia",
    });
    expect(payload.citations).toEqual([
      "https://www.wikidata.org/wiki/Q1288349",
      ITA.art,
      `${CE}St._Ita`,
    ]);
    // The page credits the Encyclopedia, and not Wikipedia, for the text.
    expect(wikipediaTextSource("SAINT", payload)).toBeNull();
    expect(publicDomainTextSource(payload)).toMatchObject({
      source: "catholic-encyclopedia-1913",
      title: "St. Ita",
    });
    expect(validatePayload("SAINT", payload).ok).toBe(true);
  });

  it("finds the page through the English article's citation when Wikidata only has the ID", async () => {
    mockedSummary.mockResolvedValue({ extract: SHORT_LEAD, url: ITA.art, lang: "en" });
    mockedSource.mockResolvedValue({
      infobox: { feast_day: "15 January" },
      prose: "",
      read: true,
      catholicEncyclopedia: [{ title: "St. Ita" }],
    });
    const payload = payloadOf(await saintMap(row({ ...ITA, ceIds: "08201c" })));
    expect(payload.provenance).toMatchObject({ biography: "catholic-encyclopedia-1913" });
  });

  it("never quotes an article on a group that does not name the saint as their biography", async () => {
    // Andrew Wouters's Catholic Encyclopedia ID (06651c) is "The Martyrs of
    // Gorkum", which opens on the year 1572 and never names him.
    mockedSummary.mockResolvedValue({
      extract: "Andrew Wouters was a Dutch priest, one of the Martyrs of Gorkum.",
      url: "https://en.wikipedia.org/wiki/Andrew_Wouters",
      lang: "en",
    });
    mockedSource.mockResolvedValue({
      infobox: { feast_day: "9 July" },
      prose: "",
      read: true,
      catholicEncyclopedia: [{ title: "Martyrs of Gorkum", newAdventId: "06651c" }],
    });
    const r = await saintMap(
      row({
        s: `${WD}Q107076198`,
        label: "Andrew Wouters",
        statuses: CATHOLIC_SAINT,
        feasts: "9 July",
        art: "https://en.wikipedia.org/wiki/Andrew_Wouters",
        ceIds: "06651c",
      }),
    );
    // The page WAS read (it is the ID's article), and refused as his biography.
    expect(wikisourceRequests).toHaveLength(1);
    expect(rejectionOf(r)?.code).toBe("description_too_short");
  });

  it("keeps description_too_short, with no request, for a saint the Encyclopedia does not cover", async () => {
    mockedSummary.mockResolvedValue({ extract: SHORT_LEAD, url: ITA.art, lang: "en" });
    expect(rejectionOf(await saintMap(row(ITA)))?.code).toBe("description_too_short");
    expect(mockedSource).not.toHaveBeenCalled();
    expect(wikisourceRequests).toHaveLength(0);
  });

  const LONG_LEAD =
    "Gregory of Elvira was a bishop of Elvira in Spain in the fourth century, known as a staunch " +
    "defender of the Nicene creed against Arianism and as the author of homilies on the Song of Songs.";
  const GREGORY = {
    s: `${WD}Q1362875`,
    label: "Gregory of Elvira",
    statuses: CATHOLIC_SAINT,
    feasts: "24 April",
    art: "https://en.wikipedia.org/wiki/Gregory_of_Elvira",
    ceArts: `${CE}Gregory_B%C3%A6ticus`,
  };

  it("corroborates the feast from the Encyclopedia when the article states none", async () => {
    mockedSummary.mockResolvedValue({ extract: LONG_LEAD, url: GREGORY.art, lang: "en" });
    const payload = payloadOf(await saintMap(row(GREGORY)));
    expect(payload.feastDay).toBe("04-24");
    expect(payload.provenance).toEqual({
      biography: "wikipedia",
      article: GREGORY.art,
      feast: "catholic-encyclopedia-1913",
      feastUrl: `${CE}Gregory_B%C3%A6ticus`,
    });
    expect(payload.citations).toContain(`${CE}Gregory_B%C3%A6ticus`);
    // The biography is still Wikipedia's, and credited as such.
    expect(wikipediaTextSource("SAINT", payload)?.title).toBe("Gregory of Elvira");
  });

  it("REFUSES when the Encyclopedia contradicts Wikidata, even where the Martyrology agrees", async () => {
    // Eugendus: Wikidata 1 January (his death); the 1916 Martyrology names him
    // on 1 January, but the Encyclopedia keeps his feast on 2 / 4 January.
    mockedSummary.mockResolvedValue({
      extract:
        "Eugendus was the fourth abbot of Condat Abbey, at Saint-Claude, Jura, in the Jura Mountains, " +
        "who rebuilt the monastery in stone.",
      url: "https://en.wikipedia.org/wiki/Eugendus",
      lang: "en",
    });
    const r = await saintMap(
      row({
        s: `${WD}Q389249`,
        label: "Eugendus",
        statuses: CATHOLIC_SAINT,
        feasts: "1 January",
        art: "https://en.wikipedia.org/wiki/Eugendus",
        ceArts: `${CE}St._Eugendus`,
      }),
    );
    expect(rejectionOf(r)).toMatchObject({
      code: "feast_contradicted",
      detail: expect.stringContaining("Catholic Encyclopedia"),
    });
  });

  it("asks no public-domain source when the article's prose words another day", async () => {
    mockedSummary.mockResolvedValue({ extract: LONG_LEAD, url: GREGORY.art, lang: "en" });
    mockedSource.mockResolvedValue({
      infobox: {},
      prose: "Veneration. His feast is kept on 23 April in the diocese of Granada.",
      read: true,
    });
    expect(rejectionOf(await saintMap(row(GREGORY)))?.code).toBe("feast_uncorroborated");
    expect(wikisourceRequests).toHaveLength(0);
  });

  it("asks no public-domain source when the infobox decides against Wikidata", async () => {
    mockedSummary.mockResolvedValue({ extract: LONG_LEAD, url: GREGORY.art, lang: "en" });
    mockedSource.mockResolvedValue({ infobox: { feast_day: "23 April" }, prose: "", read: true });
    expect(rejectionOf(await saintMap(row(GREGORY)))?.code).toBe("feast_contradicted");
    expect(wikisourceRequests).toHaveLength(0);
  });

  it("retries a row whose Encyclopedia read did not complete (Wikisource 503)", async () => {
    wikisourceStatus = 503;
    mockedSummary.mockResolvedValue({ extract: LONG_LEAD, url: GREGORY.art, lang: "en" });
    const mapped = await mapSourceRowDetailed(ingestorFor("SAINT")!, row(GREGORY));
    expect(rejectionOf(mapped.result)?.code).toBe("source_read_failed");
    expect(mapped.unreadSources).toBeGreaterThan(0);
  });

  it("holds the row, never publishes past it, when reading the Encyclopedia page throws", async () => {
    // Eugendus: the Martyrology alone would corroborate 1 January, but the
    // Encyclopedia keeps his feast on 2 / 4 January. A page that cannot be
    // parsed (here an out-of-range character reference) is an unread page —
    // never "no article" — so its veto is not lost.
    wikisourceHtml = (html) =>
      html.replace(
        "Thenceforth he never left the monastery.",
        "Thenceforth he never left the monastery.&#1114112;",
      );
    mockedSummary.mockResolvedValue({
      extract:
        "Eugendus was the fourth abbot of Condat Abbey, at Saint-Claude, Jura, in the Jura Mountains, " +
        "who rebuilt the monastery in stone.",
      url: "https://en.wikipedia.org/wiki/Eugendus",
      lang: "en",
    });
    const mapped = await mapSourceRowDetailed(
      ingestorFor("SAINT")!,
      row({
        s: `${WD}Q389249`,
        label: "Eugendus",
        statuses: CATHOLIC_SAINT,
        feasts: "1 January",
        art: "https://en.wikipedia.org/wiki/Eugendus",
        ceArts: `${CE}St._Eugendus`,
      }),
    );
    expect(wikisourceRequests).toHaveLength(1);
    expect(rejectionOf(mapped.result)?.code).toBe("source_read_failed");
    expect(mapped.unreadSources).toBeGreaterThan(0);
  });
});
