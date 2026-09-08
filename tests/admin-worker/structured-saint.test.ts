/**
 * The SAINT ingestor is the first doctrinally-sensitive structured ingestor and
 * the biggest content goal. These tests pin its accuracy contract: it produces
 * a record that passes the REAL saint schema, and it publishes a feast day ONLY
 * when that exact day is corroborated in the independent Wikipedia text —
 * skipping (never guessing) on an unknown status, a missing article, a too-short
 * biography, or an uncorroborated feast day.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
}));
vi.mock("@/lib/admin-worker/structured/wikipedia-infobox", () => ({
  fetchArticleInfobox: vi.fn(async () => ({})),
}));

import { validatePayload } from "@/lib/checklist";
import { ingestorFor } from "@/lib/admin-worker/structured/ingestors";
import { rejectionOf } from "@/lib/admin-worker/structured/reject";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { fetchArticleInfobox } from "@/lib/admin-worker/structured/wikipedia-infobox";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedInfobox = vi.mocked(fetchArticleInfobox);

const BIO =
  "Saint Rose of Lima was a Peruvian member of the Third Order of Saint Dominic, the first " +
  "person born in the Americas to be canonized; her feast day is celebrated on August 23.";

function saintMap(row: SparqlBinding) {
  return ingestorFor("SAINT")!.map(row, {} as Record<string, never>);
}

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

beforeEach(() => {
  mockedSummary.mockReset();
  mockedInfobox.mockReset();
  mockedInfobox.mockResolvedValue({});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * A row as the SAINT SPARQL now projects it (`SAINT_FACTS_SELECT`): the P411
 * statuses come as a `||`-joined list of Wikidata ITEM URIs (the ingest maps
 * status by QID, never by label — the generic "saint" label used to publish
 * Orthodox / Anglican / folk saints as Catholic `canonized`), and the feasts
 * as a `||`-joined list of calendar-date labels (every P841 value, never a
 * random SAMPLE). Q3464126 = "Catholic saint".
 */
const WD = "http://www.wikidata.org/entity/";
const FULL = {
  s: `${WD}Q170145`,
  label: "Rose of Lima",
  statuses: `${WD}Q3464126`,
  feasts: "23 August",
  art: "https://en.wikipedia.org/wiki/Rose_of_Lima",
};

describe("SAINT ingestor mapping", () => {
  it("maps a corroborated row to a SCHEMA-VALID SAINT entry", async () => {
    mockedSummary.mockResolvedValue({
      extract: BIO,
      url: "https://en.wikipedia.org/wiki/Rose_of_Lima",
    });
    const entry = await saintMap(row(FULL));
    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("saint-rose-of-lima");
    expect(entry!.payload.feastDay).toBe("08-23");
    expect(entry!.payload.canonizationStatus).toBe("canonized");
    // Bare label stays in canonicalName (dedup key); the page shows the honorific.
    expect(entry!.payload.canonicalName).toBe("Rose of Lima");
    expect(entry!.payload.title).toBe("Saint Rose of Lima");
    expect(entry!.payload.wikidataQid).toBe("Q170145");
    expect(entry!.citations).toHaveLength(2);
    expect(validatePayload("SAINT", entry!.payload).ok).toBe(true);
  });

  it("SKIPS when the feast day is not corroborated in the article text", async () => {
    mockedSummary.mockResolvedValue({
      extract:
        "Saint Rose of Lima was a Peruvian Dominican tertiary venerated across the Americas for her holiness.",
      url: "https://en.wikipedia.org/wiki/Rose_of_Lima",
    });
    expect(rejectionOf(await saintMap(row(FULL)))?.code).toBe("feast_uncorroborated");
  });

  it("SKIPS an unknown canonization status without fetching anything", async () => {
    // Q19546 (pope) is not a canonization status item.
    const entry = await saintMap(row({ ...FULL, statuses: `${WD}Q19546` }));
    expect(rejectionOf(entry)?.code).toBe("not_catholic_status");
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("SKIPS a generic 'saint' whose religion is Orthodox (never Catholic `canonized`)", async () => {
    // Q43115 = generic "saint"; Q3333484 = Eastern Orthodoxy. Nicodemus the
    // Hagiorite-style row: a feast in the infobox would corroborate, but the
    // structured record cannot prove Catholic veneration.
    mockedSummary.mockResolvedValue({ extract: BIO, url: FULL.art });
    const entry = await saintMap(
      row({ ...FULL, statuses: `${WD}Q43115`, religions: `${WD}Q3333484` }),
    );
    // The generic "saint" item carries no Catholic status, so the status guard
    // is what stops it — before the religion guard is ever consulted.
    expect(rejectionOf(entry)?.code).toBe("not_catholic_status");
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("publishes a generic 'saint' as canonized ONLY with a Catholic religion (P140)", async () => {
    mockedSummary.mockResolvedValue({ extract: BIO, url: FULL.art });
    const entry = await saintMap(
      row({ ...FULL, statuses: `${WD}Q43115`, religions: `${WD}Q9592` }),
    );
    expect(entry).not.toBeNull();
    expect(entry!.payload.canonizationStatus).toBe("canonized");
  });

  it("resolves a multi-status saint to the HIGHEST rank, never an arbitrary pick", async () => {
    // "blessed" (Q2369287) kept alongside "Catholic saint" after canonization.
    mockedSummary.mockResolvedValue({ extract: BIO, url: FULL.art });
    const entry = await saintMap(row({ ...FULL, statuses: `${WD}Q2369287||${WD}Q3464126` }));
    expect(entry!.payload.canonizationStatus).toBe("canonized");
    expect(entry!.payload.title).toBe("Saint Rose of Lima");
  });

  it("titles a Blessed as 'Blessed …' and keeps an existing honorific", async () => {
    mockedSummary.mockResolvedValue({ extract: BIO, url: FULL.art });
    const blessed = await saintMap(row({ ...FULL, statuses: `${WD}Q2369287` }));
    expect(blessed!.payload.title).toBe("Blessed Rose of Lima");
    const already = await saintMap(row({ ...FULL, label: "Saint Rose of Lima" }));
    expect(already!.payload.title).toBe("Saint Rose of Lima");
    expect(already!.slug).toBe("saint-rose-of-lima");
  });

  it("SKIPS when there is no Wikipedia article", async () => {
    const { art: _art, ...noArticle } = FULL;
    void _art;
    expect(rejectionOf(await saintMap(row(noArticle)))?.code).toBe("no_wikipedia_article");
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("SKIPS when the biography is too short for the schema", async () => {
    mockedSummary.mockResolvedValue({ extract: "Too short.", url: FULL.art });
    expect(rejectionOf(await saintMap(row(FULL)))?.code).toBe("description_too_short");
  });
});

describe("SAINT ingestor — infobox corroboration + enrichment", () => {
  const PROSE_NO_FEAST =
    "Saint Rose of Lima was a Peruvian Dominican tertiary venerated across the Americas for her extraordinary holiness of life.";

  it("corroborates via the infobox feast_day when the abstract omits the feast", async () => {
    mockedSummary.mockResolvedValue({ extract: PROSE_NO_FEAST, url: FULL.art });
    mockedInfobox.mockResolvedValue({ feast_day: "23 August" });

    const entry = await saintMap(row(FULL));

    expect(entry).not.toBeNull();
    expect(entry!.payload.feastDay).toBe("08-23");
    expect(validatePayload("SAINT", entry!.payload).ok).toBe(true);
  });

  it("still SKIPS when the infobox feast disagrees with Wikidata", async () => {
    mockedSummary.mockResolvedValue({ extract: PROSE_NO_FEAST, url: FULL.art });
    mockedInfobox.mockResolvedValue({ feast_day: "30 August" });

    expect(rejectionOf(await saintMap(row(FULL)))?.code).toBe("feast_uncorroborated");
  });

  it("multi-feast saint: publishes ONLY the day the infobox lists first, else skips", async () => {
    // Thomas Aquinas-style: General Roman Calendar date + pre-1969 date on
    // Wikidata. Prose naming the historical date must not decide.
    const TWO = { ...FULL, feasts: "7 March||28 January" };
    mockedSummary.mockResolvedValue({
      extract: PROSE_NO_FEAST + " Before 1969 the feast was kept on 7 March.",
      url: FULL.art,
    });
    mockedInfobox.mockResolvedValue({ feast_day: "28 January; 7 March (pre-1969 calendar)" });
    const entry = await saintMap(row(TWO));
    expect(entry).not.toBeNull();
    expect(entry!.payload.feastDay).toBe("01-28");

    // No infobox to disambiguate → ambiguous → skip (never guess).
    mockedInfobox.mockResolvedValue({});
    // Ambiguous is not the same failure as uncorroborated: two feast days with
    // nothing to order them by, versus a day the article never states.
    expect(rejectionOf(await saintMap(row(TWO)))?.code).toBe("feast_ambiguous");
  });

  it("enriches the record with cited infobox fields (patronage, dates, canonized by)", async () => {
    mockedSummary.mockResolvedValue({
      extract: PROSE_NO_FEAST + " Her feast day is celebrated on August 23.",
      url: FULL.art,
    });
    mockedInfobox.mockResolvedValue({
      feast_day: "23 August",
      patronage: "Lima, Peru; embroiderers, gardeners",
      birth_date: "1586-04-20",
      death_date: "1617-08-24",
      canonized_date: "12 April 1671",
      canonized_by: "Pope Clement X",
    });

    const entry = await saintMap(row(FULL));

    expect(entry).not.toBeNull();
    expect(entry!.payload.patronages).toEqual(["Lima", "Peru", "embroiderers", "gardeners"]);
    expect(entry!.payload.birthDate).toBe("1586-04-20");
    expect(entry!.payload.deathDate).toBe("1617-08-24");
    expect(entry!.payload.canonizationDate).toBe("12 April 1671");
    expect(entry!.payload.canonizedBy).toBe("Pope Clement X");
    expect(validatePayload("SAINT", entry!.payload).ok).toBe(true);
  });
});

/**
 * Two rules measured against the live corpus on 2026-09-08 and changed here.
 *
 * (1) The infobox leads with the date the calendar keeps TODAY. Once
 * `cleanInfoboxValue` stopped erasing `{{unbulleted list}}` feast parameters,
 * Pope Zephyrinus (Q101306) — P841 26 August, infobox "20 December (…); 26
 * August (Latin Church pre-1969)" — would have published a date suppressed in
 * 1969 as his feast, because a single Wikidata value used to be corroborated by
 * appearing ANYWHERE in the parameter. The date must be the one the infobox
 * names first, or the row is ambiguous and is skipped.
 *
 * (2) A saint with no P411 at all takes their status from the article. The
 * canonization DATE that rule demanded can never exist for a pre-congregation
 * saint, which is why Bl. Egino of Augsburg (Q102290) — `venerated_in =
 * Catholic Church`, `honorific_prefix = Saint`, `feast_day = 15 July` — was
 * rejected as `no_canonization_date`. The article's own statement of WHO
 * venerates him and at WHICH stage is the fact the record needs, and it is a
 * stricter test of Catholicity than "this field contains four digits".
 */
describe("SAINT ingestor — feast ordering and pre-congregation status", () => {
  const PROSE = "Pope Zephyrinus was the bishop of Rome from the year 199 until his death in 217.";

  it("SKIPS the suppressed date Pope St Leo II was actually publishing", async () => {
    // Q103328, measured live on 2026-09-08 — a row that PUBLISHED before this
    // rule. Wikidata's single P841 value is 3 July; his article's infobox reads
    // "28 June (3 July, pre-1970 calendar)". The General Roman Calendar keeps
    // him on 28 June, so the ingest was shipping a date suppressed in 1970 as
    // this saint's feast day. Nothing about the parameter is malformed — "does
    // 3 July appear?" simply cannot tell a feast from its own footnote.
    mockedSummary.mockResolvedValue({
      extract:
        "Pope Leo II was the bishop of Rome from 17 August 682 to his death. He is one of the " +
        "popes of the Byzantine Papacy and is chiefly remembered for confirming the acts of the " +
        "Third Council of Constantinople.",
      url: FULL.art,
    });
    mockedInfobox.mockResolvedValue({ feast_day: "28 June (3 July, pre-1970 calendar)" });
    const entry = await saintMap(row({ ...FULL, feasts: "3 July" }));
    expect(rejectionOf(entry)?.code).toBe("feast_ambiguous");
  });

  it("SKIPS as ambiguous when the infobox names a different day BEFORE Wikidata's", async () => {
    mockedSummary.mockResolvedValue({ extract: PROSE + " ".repeat(40), url: FULL.art });
    mockedInfobox.mockResolvedValue({
      feast_day:
        "20 December (Maronite Church, Orthodox Churches, Latin Church); " +
        "26 August (Latin Church pre-1969)",
    });
    const entry = await saintMap(row({ ...FULL, feasts: "26 August" }));
    expect(rejectionOf(entry)?.code).toBe("feast_ambiguous");
  });

  it("publishes when Wikidata's day is the one the infobox names FIRST", async () => {
    mockedSummary.mockResolvedValue({ extract: PROSE + " ".repeat(40), url: FULL.art });
    mockedInfobox.mockResolvedValue({
      feast_day: "26 August (Latin Church); 20 December (Maronite Church)",
    });
    const entry = await saintMap(row({ ...FULL, feasts: "26 August" }));
    expect(entry).not.toBeNull();
    expect(entry!.payload.feastDay).toBe("08-26");
  });

  it("takes a pre-congregation status from venerated_in + the honorific", async () => {
    // No P411 (branch 3): Wikidata gives only a Catholic religion + a feast.
    const EGINO = {
      s: `${WD}Q102290`,
      label: "Egino",
      religions: `${WD}Q9592`,
      feasts: "15 July",
      art: "https://en.wikipedia.org/wiki/Saint_Egino",
    };
    mockedSummary.mockResolvedValue({
      extract:
        "Egino was born in Augsburg, Bavaria, and was a Camaldolese abbot involved in the many " +
        "disputes of his era, supporting Pope Callistus II against Emperor Henry V.",
      url: EGINO.art,
    });
    mockedInfobox.mockResolvedValue({
      honorific_prefix: "Saint",
      feast_day: "15 July",
      venerated_in: "Catholic Church",
    });
    const entry = await saintMap(row(EGINO));
    expect(entry).not.toBeNull();
    expect(entry!.payload.canonizationStatus).toBe("canonized");
    expect(entry!.payload.feastDay).toBe("07-15");
    expect(validatePayload("SAINT", entry!.payload).ok).toBe(true);
  });

  it("never promotes a Blessed to canonized on the honorific", async () => {
    const B = {
      s: `${WD}Q1`,
      label: "Someone",
      religions: `${WD}Q9592`,
      feasts: "15 July",
      art: "https://en.wikipedia.org/wiki/X",
    };
    mockedSummary.mockResolvedValue({ extract: "A".repeat(140), url: B.art });
    mockedInfobox.mockResolvedValue({
      honorific_prefix: "Blessed",
      feast_day: "15 July",
      venerated_in: "Catholic Church",
    });
    expect((await saintMap(row(B)))!.payload.canonizationStatus).toBe("beatified");
  });

  it("REFUSES a status when the venerating body is not the Catholic Church", async () => {
    const B = {
      s: `${WD}Q2`,
      label: "Someone Else",
      religions: `${WD}Q9592`,
      feasts: "15 July",
      art: "https://en.wikipedia.org/wiki/Y",
    };
    mockedSummary.mockResolvedValue({ extract: "A".repeat(140), url: B.art });
    for (const venerated_in of ["Eastern Orthodox Church", "Old Catholic Church", "Anglicanism"]) {
      mockedInfobox.mockResolvedValue({
        honorific_prefix: "Saint",
        feast_day: "15 July",
        venerated_in,
      });
      expect(rejectionOf(await saintMap(row(B)))?.code).toBe("no_canonization_date");
    }
  });

  it("REFUSES a status when the article states no stage at all", async () => {
    // Thietmar of Minden (Q102313): venerated_in = Roman Catholic Church, but
    // the only title the infobox gives is "Bishop" — which is not a stage.
    const T = {
      s: `${WD}Q102313`,
      label: "Thietmar of Minden",
      religions: `${WD}Q9592`,
      feasts: "5 March",
      art: "https://en.wikipedia.org/wiki/Thietmar_of_Minden",
    };
    mockedSummary.mockResolvedValue({ extract: "A".repeat(140), url: T.art });
    mockedInfobox.mockResolvedValue({
      feast_day: "5 March",
      venerated_in: "Roman Catholic Church",
      titles: "Bishop",
    });
    expect(rejectionOf(await saintMap(row(T)))?.code).toBe("no_canonization_date");
  });
});

/**
 * The Catholic BOUNDARY on branch 3 (no P411 at all), pinned against the ways
 * the infobox rule was found to be crossable.
 *
 * Branch 3 is the only path on which the ARTICLE, rather than Wikidata's P411,
 * decides that someone is a Catholic saint, so it is the one place where a
 * loose word match publishes another communion's saint — or promotes a bishop
 * to a canonised one — under the Catholic content type. Both holes below were
 * reproduced against the mapper before they were closed.
 */
describe("SAINT ingestor — the branch-3 Catholic boundary", () => {
  const BRANCH3 = {
    s: `${WD}Q999`,
    label: "Probe Person",
    religions: `${WD}Q9592`,
    feasts: "15 July",
    art: "https://en.wikipedia.org/wiki/Probe",
  };

  async function withInfobox(infobox: Record<string, string>) {
    mockedSummary.mockResolvedValue({ extract: "A".repeat(140), url: BRANCH3.art });
    mockedInfobox.mockResolvedValue(infobox);
    return saintMap(row(BRANCH3));
  }

  it("REFUSES the communions whose NAME merely contains 'Catholic'", async () => {
    // Each of these satisfies a bare /\bcatholic\b/ and none is in communion
    // with Rome, so each would have published its own saint as a Roman one.
    for (const venerated_in of [
      "Polish National Catholic Church",
      "Anglican Catholic Church",
      "Liberal Catholic Church",
      "Catholic Apostolic Church",
      "Old Catholic Church",
    ]) {
      const entry = await withInfobox({
        venerated_in,
        honorific_prefix: "Saint",
        feast_day: "15 July",
      });
      expect(rejectionOf(entry)?.code).toBe("no_canonization_date");
    }
  });

  it("still accepts a saint venerated by BOTH Rome and the East", async () => {
    // A pre-schism saint must not be collateral damage of the rule above.
    const entry = await withInfobox({
      venerated_in: "Catholic Church, Eastern Orthodox Church",
      honorific_prefix: "Saint",
      feast_day: "15 July",
    });
    expect(entry).not.toBeNull();
    expect(entry!.payload.canonizationStatus).toBe("canonized");
  });

  it("still accepts an EASTERN Catholic church as the venerating body", async () => {
    // Coptic Catholic / Syro-Malabar are in communion with Rome and trip the
    // "another communion" word list; naming a Catholic body is what saves them.
    for (const venerated_in of ["Coptic Catholic Church", "Syro-Malabar Catholic Church"]) {
      const entry = await withInfobox({
        venerated_in,
        honorific_prefix: "Saint",
        feast_day: "15 July",
      });
      expect(entry).not.toBeNull();
      expect(entry!.payload.canonizationStatus).toBe("canonized");
    }
  });

  it("REFUSES a canonization DATE when the venerating body is another communion", async () => {
    // The date rule reads four digits out of a field and asks nothing about who
    // canonised whom. It mattered less while `{{start date|…}}` was being erased
    // by the infobox cleaner; now that those dates parse it is reached far more
    // often, so it needs the same floor as the honorific rule.
    for (const venerated_in of [
      "Eastern Orthodox Church",
      // Striking the borrowed word has to COUNT as naming another communion:
      // otherwise "Old Catholic Church" reduces to " Church" and reads as no
      // venerating body at all, which lets the date rule through unchallenged.
      "Old Catholic Church",
      "Polish National Catholic Church",
      "Armenian Apostolic Church",
    ]) {
      const entry = await withInfobox({
        venerated_in,
        canonized_date: "1997-10-19",
        feast_day: "15 July",
      });
      expect(rejectionOf(entry)?.code).toBe("no_canonization_date");
    }
  });

  it("leaves the date rule alone when the article names no venerating body", async () => {
    const entry = await withInfobox({ canonized_date: "1997-10-19", feast_day: "15 July" });
    expect(entry!.payload.canonizationStatus).toBe("canonized");
  });

  it("never reads a canonization STAGE out of an office", async () => {
    // `titles` / `title` hold offices, and an office routinely carries a place
    // name: each of these matched /\bsaint\b|\bst\.?\b/ and published the
    // person as `canonized`. A diocese named after a saint says nothing about
    // its bishop's cause.
    for (const office of [
      { titles: "Bishop of St Albans" },
      { title: "Abbot of St Gall" },
      { titles: "Bishop of Saint-Denis" },
      { titles: "Priest, Founder of the Congregation of the Blessed Sacrament" },
    ]) {
      const entry = await withInfobox({
        venerated_in: "Catholic Church",
        feast_day: "15 July",
        ...office,
      });
      expect(rejectionOf(entry)?.code).toBe("no_canonization_date");
    }
  });
});
