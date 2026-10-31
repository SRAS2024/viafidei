/**
 * The SAINT gates tightened on 2026-10-31, after a 30-saint sample of the
 * not-yet-live corpus showed 7 of the 18 that would publish contradicting their
 * own article's infobox feast, one with a wrong stage (Józef Cebula), and
 * Venerables published with a feast they cannot liturgically have:
 *   - a dated infobox feast DECIDES: its first date must be Wikidata's, and a
 *     mention of the date in the abstract (usually the death date) cannot
 *     override it;
 *   - prose corroborates only with feast / memorial / commemorated / liturgical
 *     wording within ~80 characters of the date, in the lead or the body;
 *   - Wikidata's stage must agree with the article's;
 *   - a Venerable / Servant of God publishes WITHOUT a feast, and only when the
 *     article names the stage;
 *   - no template biographies: no English article, no record.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
  fetchIntroForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/structured/wikipedia-infobox", () => {
  const fetchArticleInfobox = vi.fn(async (_url: string): Promise<Record<string, string>> => ({}));
  return {
    fetchArticleInfobox,
    fetchArticleSource: vi.fn(async (url: string) => ({
      infobox: await fetchArticleInfobox(url),
      prose: (globalThis as { __saintProse?: string }).__saintProse ?? "",
    })),
  };
});

import { validatePayload } from "@/lib/checklist";
import {
  feastMentionSpans,
  feastStatedWithWording,
  parseFeastValue,
} from "@/lib/admin-worker/structured/corroboration";
import {
  articleStageConflict,
  chooseCorroboratedFeastDetailed,
  ingestorFor,
} from "@/lib/admin-worker/structured/ingestors";
import { rejectionOf } from "@/lib/admin-worker/structured/reject";
import {
  fetchIntroForArticleUrl,
  fetchSummaryForArticleUrl,
} from "@/lib/admin-worker/structured/wikipedia";
import { fetchArticleInfobox } from "@/lib/admin-worker/structured/wikipedia-infobox";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedIntro = vi.mocked(fetchIntroForArticleUrl);
const mockedInfobox = vi.mocked(fetchArticleInfobox);

function setProse(text: string): void {
  (globalThis as { __saintProse?: string }).__saintProse = text;
}

beforeEach(() => {
  mockedSummary.mockReset();
  mockedIntro.mockReset();
  mockedIntro.mockResolvedValue(null);
  mockedInfobox.mockReset();
  mockedInfobox.mockResolvedValue({});
  setProse("");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const WD = "http://www.wikidata.org/entity/";
const CATHOLIC_SAINT = `${WD}Q3464126`;
const BLESSED = `${WD}Q2369287`;
const VENERABLE = `${WD}Q51619`;
const SERVANT = `${WD}Q869974`;
const CATHOLIC_CHURCH = `${WD}Q9592`;

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

function saintMap(r: SparqlBinding) {
  return ingestorFor("SAINT")!.map(r, {} as Record<string, never>);
}

const KOLPING = {
  s: `${WD}Q60619`,
  label: "Adolph Kolping",
  statuses: BLESSED,
  feasts: "4 December",
  art: "https://en.wikipedia.org/wiki/Adolph_Kolping",
};
const KOLPING_LEAD =
  "Blessed Adolph Kolping was a German Catholic priest and the founder of the Kolping Society. " +
  "He died in Cologne on 4 December 1865 and was beatified by Pope John Paul II in 1991.";

function feast(label: string) {
  return parseFeastValue({ label })!;
}

describe("a dated infobox feast decides — the abstract cannot override it", () => {
  it("SKIPS a saint whose abstract names the death date while the infobox gives another feast", async () => {
    // Before: the abstract check ran FIRST and accepted any mention of 4 December.
    mockedSummary.mockResolvedValue({ extract: KOLPING_LEAD, url: KOLPING.art, lang: "en" });
    mockedInfobox.mockResolvedValue({ feast_day: "6 December", beatified_date: "1991-10-27" });
    expect(rejectionOf(await saintMap(row(KOLPING)))?.code).toBe("feast_contradicted");
  });

  it("publishes when the infobox's FIRST date is Wikidata's", async () => {
    mockedSummary.mockResolvedValue({ extract: KOLPING_LEAD, url: KOLPING.art, lang: "en" });
    mockedInfobox.mockResolvedValue({ feast_day: "4 December", beatified_date: "1991-10-27" });
    const entry = await saintMap(row(KOLPING));
    expect(rejectionOf(entry)).toBeNull();
    expect(entry).toMatchObject({
      payload: { feastDay: "12-04", canonizationStatus: "beatified" },
    });
  });

  it("keeps the infobox-first rule for several Wikidata values", () => {
    const candidates = [feast("7 March"), feast("28 January")];
    const ib = (feast_day: string) => ({ feast_day });
    expect(
      chooseCorroboratedFeastDetailed({
        candidates,
        abstract: "",
        infobox: ib("28 January; 7 March (pre-1969)"),
        lang: "en",
      }).feast?.feastDay,
    ).toBe("01-28");
    // Wikidata's days named only after another one: historical → ambiguous.
    expect(
      chooseCorroboratedFeastDetailed({
        candidates,
        abstract: "",
        infobox: ib("20 December; 7 March (pre-1969)"),
        lang: "en",
      }).code,
    ).toBe("feast_ambiguous");
  });
});

describe("prose corroboration needs feast wording next to the date", () => {
  it("does NOT accept a bare date in the lead (usually the death date)", async () => {
    mockedSummary.mockResolvedValue({ extract: KOLPING_LEAD, url: KOLPING.art, lang: "en" });
    mockedInfobox.mockResolvedValue({ beatified_date: "1991-10-27" });
    expect(rejectionOf(await saintMap(row(KOLPING)))?.code).toBe("feast_uncorroborated");
  });

  it("accepts the date with feast wording in the lead", async () => {
    mockedSummary.mockResolvedValue({
      extract: `${KOLPING_LEAD} His liturgical feast is kept on 4 December.`,
      url: KOLPING.art,
      lang: "en",
    });
    const entry = await saintMap(row(KOLPING));
    expect(rejectionOf(entry)).toBeNull();
    expect(validatePayload("SAINT", entry && "payload" in entry ? entry.payload : {}).ok).toBe(
      true,
    );
  });

  it("accepts it from the article BODY when the lead is silent", async () => {
    mockedSummary.mockResolvedValue({ extract: KOLPING_LEAD, url: KOLPING.art, lang: "en" });
    setProse(
      "Veneration. Kolping was beatified in 1991. The Church commemorates him on 4 December, the day of his death.",
    );
    expect(rejectionOf(await saintMap(row(KOLPING)))).toBeNull();
  });

  it("measures the window: feast wording 80+ characters away does not count", () => {
    const far = `The feast of the parish is popular. ${"x".repeat(90)} Cologne keeps 4 December.`;
    const near = "Cologne keeps 4 December, the day he died, as his memorial.";
    expect(feastStatedWithWording(12, 4, far, "en")).toBe(false);
    expect(feastStatedWithWording(12, 4, near, "en")).toBe(true);
  });

  it("never reads a dated EVENT as the feast, however close the feast wording (Goupil)", () => {
    // René Goupil "was killed on the Feast of St. Michael the Archangel,
    // 29 September 1642" — Wikidata's P841 is 29 September; his feast is not.
    const goupil =
      "Goupil was killed on the Feast of St. Michael the Archangel, 29 September 1642, by a blow " +
      "to the head with a tomahawk.";
    expect(feastStatedWithWording(9, 29, goupil, "en")).toBe(false);
    expect(feastStatedWithWording(7, 14, "Festa: 14 luglio, 1614 a Roma.", "it")).toBe(false);
  });

  it("reads a feast wrapped in a template the infobox cleaner does not know", async () => {
    const { parseInfobox } = await vi.importActual<
      typeof import("@/lib/admin-worker/structured/wikipedia-infobox")
    >("@/lib/admin-worker/structured/wikipedia-infobox");
    const box = parseInfobox(
      "{{Infobox saint\n|feast_day={{cslist|26 September (Canada)|19 October (United States)}}\n" +
        "|patronage={{some unknown wrapper|Canada}}\n}}",
    );
    expect(box.feast_day).toBe("26 September (Canada); 19 October (United States)");
    // Only feast parameters fall back to reading unknown templates.
    expect(box.patronage).toBeUndefined();
    const choice = chooseCorroboratedFeastDetailed({
      candidates: [feast("29 September")],
      abstract: "",
      infobox: box,
      lang: "en",
      prose: "He died on 29 September 1642. His feast is kept on 29 September in Auriesville.",
    });
    expect(choice.code).toBe("feast_contradicted");
  });

  it("skips when the infobox states a feast that is no calendar day", () => {
    const choice = chooseCorroboratedFeastDetailed({
      candidates: [feast("12 May")],
      abstract: "His feast day is 12 May.",
      infobox: { feast_day: "Fourth Sunday of Easter" },
      lang: "en",
    });
    expect(choice.code).toBe("feast_uncorroborated");
  });

  it("looks at EVERY mention of the date, not only the first", () => {
    const text = "Born 4 December 1813. Later, 4 December became his feast day.";
    expect(feastMentionSpans(12, 4, text, "en")).toHaveLength(2);
    expect(feastStatedWithWording(12, 4, "Born 4 December 1813.", "en")).toBe(false);
    expect(feastStatedWithWording(12, 4, text, "en")).toBe(true);
  });

  it("reads the supported languages, never the Polish 'saint' adjective as a feast", () => {
    expect(feastStatedWithWording(7, 14, "La sua memoria liturgica è il 14 luglio.", "it")).toBe(
      true,
    );
    expect(feastStatedWithWording(7, 14, "Morì il 14 luglio 1614 a Roma.", "it")).toBe(false);
    expect(feastStatedWithWording(10, 5, "Wspomnienie liturgiczne: 5 października.", "pl")).toBe(
      true,
    );
    expect(feastStatedWithWording(10, 5, "Święta Faustyna zmarła 5 października 1938.", "pl")).toBe(
      false,
    );
    expect(feastStatedWithWording(7, 14, "Gedenktag ist der 14. Juli.", "de")).toBe(true);
    expect(feastStatedWithWording(7, 14, "Er wurde am 14. Juli festgenommen.", "de")).toBe(false);
  });
});

describe("Wikidata's stage must agree with the article", () => {
  const CEBULA = {
    s: `${WD}Q475873`,
    label: "Józef Cebula",
    // Wikidata carries BOTH "blessed" and "Catholic saint" → resolves to canonized.
    statuses: `${BLESSED}||${CATHOLIC_SAINT}`,
    feasts: "12 June",
    art: "https://en.wikipedia.org/wiki/J%C3%B3zef_Cebula",
  };
  const LEAD =
    "Józef Cebula was a Polish Roman Catholic priest of the Missionary Oblates of Mary Immaculate " +
    "who was killed in the Mauthausen-Gusen concentration camp during the Second World War.";

  it("SKIPS a 'canonized' row whose article records only a beatification (Cebula)", async () => {
    mockedSummary.mockResolvedValue({ extract: LEAD, url: CEBULA.art, lang: "en" });
    mockedInfobox.mockResolvedValue({ beatified_date: "13 June 1999", feast_day: "12 June" });
    expect(rejectionOf(await saintMap(row(CEBULA)))?.code).toBe("status_contradicted");
  });

  it("…and one whose article only calls him Blessed", async () => {
    mockedSummary.mockResolvedValue({ extract: LEAD, url: CEBULA.art, lang: "en" });
    mockedInfobox.mockResolvedValue({ honorific_prefix: "Blessed", feast_day: "12 June" });
    expect(rejectionOf(await saintMap(row(CEBULA)))?.code).toBe("status_contradicted");
  });

  it("publishes once the article dates the canonization", async () => {
    mockedSummary.mockResolvedValue({ extract: LEAD, url: CEBULA.art, lang: "en" });
    mockedInfobox.mockResolvedValue({
      beatified_date: "13 June 1999",
      canonized_date: "2030",
      feast_day: "12 June",
    });
    const entry = await saintMap(row(CEBULA));
    expect(entry).toMatchObject({ payload: { canonizationStatus: "canonized" } });
  });

  it("SKIPS a lower Wikidata stage when the article dates a later one", () => {
    expect(articleStageConflict("beatified", { canonized_date: "2022" })).toBe("canonized");
    expect(articleStageConflict("venerable", { beatified_date: "2020" })).toBe("beatified");
    expect(articleStageConflict("beatified", { beatified_date: "2020" })).toBeNull();
    expect(articleStageConflict("canonized", { honorific_prefix: "Saint" })).toBeNull();
    expect(articleStageConflict("canonized", {})).toBeNull();
  });

  it("reads a later stage from the honorific when the article names the Catholic Church", () => {
    // Moisés Lira Serafín: beatified 2014, still "Venerable" on Wikidata; his
    // infobox says "Blessed" and "Catholic Church" but dates nothing.
    const lira = { honorific_prefix: "Blessed", venerated_in: "Catholic Church" };
    expect(articleStageConflict("venerable", lira)).toBe("beatified");
    expect(
      articleStageConflict("servant_of_god", {
        honorific_prefix: "Venerable",
        venerated: "Roman Catholic Church",
      }),
    ).toBe("venerable");
    // `honored_in` names the venerating body too (Edward Colman's infobox).
    expect(
      articleStageConflict("venerable", {
        honorific_prefix: "Blessed",
        honored_in: "Roman Catholic Church",
      }),
    ).toBe("beatified");
    // An honorific alone, with no Catholic venerating body, proves nothing.
    expect(articleStageConflict("venerable", { honorific_prefix: "Blessed" })).toBeNull();
    expect(
      articleStageConflict("venerable", {
        honorific_prefix: "Saint",
        venerated_in: "Eastern Orthodox Church",
      }),
    ).toBeNull();
    expect(articleStageConflict("venerable", { honorific_prefix: "Venerable" })).toBeNull();
  });
});

describe("a stage the article gives another communion is not a Catholic one", () => {
  // Wikidata's "Venerable" (Q51619) is shared with Orthodox and Protestant
  // usage. With no religion on the record, an Orthodox monk resolves to the
  // Catholic stage, and his article's own "Venerable" honorific used to be
  // read as confirming it.
  const ORTHODOX_MONK = {
    s: `${WD}Q5000101`,
    label: "Paisius Velichkovsky",
    statuses: VENERABLE,
    feasts: "15 November",
    art: "https://en.wikipedia.org/wiki/Paisius_Velichkovsky",
  };
  const LEAD =
    "Paisius Velichkovsky was a monk and spiritual writer from Poltava who revived hesychasm in " +
    "the monasteries of Moldavia; he is honoured as the Venerable Paisius.";

  it("SKIPS a 'Venerable' whose article names only the Orthodox Church", async () => {
    mockedSummary.mockResolvedValue({ extract: LEAD, url: ORTHODOX_MONK.art, lang: "en" });
    mockedInfobox.mockResolvedValue({
      honorific_prefix: "Venerable",
      venerated_in: "Eastern Orthodox Church",
      feast_day: "15 November",
    });
    expect(rejectionOf(await saintMap(row(ORTHODOX_MONK)))?.code).toBe("status_contradicted");
  });

  it("SKIPS a 'Catholic saint' whose article names only the Anglican Communion", async () => {
    mockedSummary.mockResolvedValue({
      extract: `${KOLPING_LEAD} His feast day is 4 December.`,
      url: KOLPING.art,
      lang: "en",
    });
    mockedInfobox.mockResolvedValue({
      venerated_in: "Anglican Communion",
      feast_day: "4 December",
    });
    expect(rejectionOf(await saintMap(row({ ...KOLPING, statuses: CATHOLIC_SAINT })))?.code).toBe(
      "status_contradicted",
    );
  });

  it("still publishes when the article names the Catholic Church beside another communion", async () => {
    mockedSummary.mockResolvedValue({ extract: KOLPING_LEAD, url: KOLPING.art, lang: "en" });
    mockedInfobox.mockResolvedValue({
      venerated_in: "Catholic Church; Eastern Orthodox Church",
      beatified_date: "1991-10-27",
      feast_day: "4 December",
    });
    expect(rejectionOf(await saintMap(row(KOLPING)))).toBeNull();
  });
});

describe("Venerables and Servants of God have no liturgical feast", () => {
  const SHEEN = {
    s: `${WD}Q463048`,
    label: "Fulton J. Sheen",
    statuses: VENERABLE,
    religions: CATHOLIC_CHURCH,
    feasts: "9 December",
    art: "https://en.wikipedia.org/wiki/Fulton_J._Sheen",
  };
  const LEAD =
    "Fulton John Sheen was an American bishop of the Catholic Church known for his preaching on " +
    "television and radio. He was declared Venerable by Pope Benedict XVI in 2012.";

  it("publishes a Venerable WITHOUT a feast, schema-valid, titled Venerable", async () => {
    mockedSummary.mockResolvedValue({ extract: LEAD, url: SHEEN.art, lang: "en" });
    mockedInfobox.mockResolvedValue({ feast_day: "9 December" });
    const entry = await saintMap(row(SHEEN));
    expect(rejectionOf(entry)).toBeNull();
    const payload = (entry as { payload: Record<string, unknown> }).payload;
    expect(payload.canonizationStatus).toBe("venerable");
    expect(payload.title).toBe("Venerable Fulton J. Sheen");
    expect(payload).not.toHaveProperty("feastDay");
    expect(payload).not.toHaveProperty("feastMonth");
    expect(payload).not.toHaveProperty("feastDayOfMonth");
    expect(validatePayload("SAINT", payload).ok).toBe(true);
  });

  it("SKIPS a Venerable the article never calls one (the stage is shared with the Orthodox)", async () => {
    mockedSummary.mockResolvedValue({
      extract: LEAD.replace(" He was declared Venerable by Pope Benedict XVI in 2012.", "").padEnd(
        120,
        " ",
      ),
      url: SHEEN.art,
      lang: "en",
    });
    expect(rejectionOf(await saintMap(row(SHEEN)))?.code).toBe("status_uncorroborated");
  });

  it("publishes a Servant of God without a feast", async () => {
    mockedSummary.mockResolvedValue({
      extract:
        "Dorothy Day was an American journalist, social activist and Catholic convert. Her cause " +
        "for canonization is open, and she has the title Servant of God.",
      url: "https://en.wikipedia.org/wiki/Dorothy_Day",
      lang: "en",
    });
    const entry = await saintMap(
      row({
        s: `${WD}Q441617`,
        label: "Dorothy Day",
        statuses: SERVANT,
        religions: CATHOLIC_CHURCH,
        feasts: "29 November",
        art: "https://en.wikipedia.org/wiki/Dorothy_Day",
      }),
    );
    const payload = (entry as { payload: Record<string, unknown> }).payload;
    expect(payload.canonizationStatus).toBe("servant_of_god");
    expect(payload).not.toHaveProperty("feastDay");
  });

  it("the schema refuses a feast on a Venerable and requires one on a saint", () => {
    const base = {
      slug: "saint-x",
      canonicalName: "X",
      biography: "B".repeat(120),
      saintType: "other",
      citations: ["https://www.wikidata.org/wiki/Q1", "https://en.wikipedia.org/wiki/X"],
    };
    const withFeast = { feastDay: "12-09", feastMonth: 12, feastDayOfMonth: 9 };
    expect(validatePayload("SAINT", { ...base, canonizationStatus: "venerable" }).ok).toBe(true);
    expect(
      validatePayload("SAINT", { ...base, canonizationStatus: "venerable", ...withFeast }).ok,
    ).toBe(false);
    expect(
      validatePayload("SAINT", { ...base, canonizationStatus: "servant_of_god", feastDay: "12-09" })
        .ok,
    ).toBe(false);
    expect(validatePayload("SAINT", { ...base, canonizationStatus: "canonized" }).ok).toBe(false);
    expect(
      validatePayload("SAINT", { ...base, canonizationStatus: "canonized", ...withFeast }).ok,
    ).toBe(true);
  });
});

describe("no template biographies", () => {
  it("SKIPS a saint with only a non-English article, before any Wikipedia request", async () => {
    const entry = await saintMap(
      row({
        s: `${WD}Q3637802`,
        label: "Bellinus of Padua",
        statuses: CATHOLIC_SAINT,
        feasts: "26 November",
        altArts: "https://it.wikipedia.org/wiki/Bellino_di_Padova",
      }),
    );
    expect(rejectionOf(entry)?.code).toBe("biography_unavailable");
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("records where the biography came from, for the page's attribution line", async () => {
    mockedSummary.mockResolvedValue({
      extract: `${KOLPING_LEAD} His feast day is 4 December.`,
      url: KOLPING.art,
      lang: "en",
    });
    const entry = await saintMap(row(KOLPING));
    expect(entry).toMatchObject({
      payload: { provenance: { biography: "wikipedia", article: KOLPING.art } },
    });
  });
});

/**
 * The documented cases: the 30-saint sample of the not-yet-live corpus taken
 * on 2026-10-31, Wikidata's P841 / P411 against each article's own infobox as
 * they read that day (the infobox values were re-checked live; the leads are
 * paraphrased to carry the dates each case turns on). Before these gates,
 * seven of them published a feast their article contradicts — Wikidata's
 * P841 was the death date, and the lead names the death date — and Józef
 * Cebula published as canonized. Eugendus's and Cebula's REST summaries are
 * one line (69 and 84 characters); live, the whole introduction is read for
 * them and they reach these gates too.
 */
describe("the documented 2026-10-31 cases", () => {
  interface Case {
    name: string;
    qid: string;
    statuses: string;
    feasts: string;
    art: string;
    lead: string;
    infobox: Record<string, string>;
    prose?: string;
  }
  const at = (title: string) => `https://en.wikipedia.org/wiki/${title}`;
  const map = async (c: Case) => {
    mockedSummary.mockResolvedValue({ extract: c.lead, url: c.art, lang: "en" });
    mockedInfobox.mockResolvedValue(c.infobox);
    setProse(c.prose ?? "");
    return saintMap(
      row({
        s: `${WD}${c.qid}`,
        label: c.name,
        statuses: c.statuses,
        feasts: c.feasts,
        art: c.art,
      }),
    );
  };

  const MONTEGALLO_LEAD =
    "Marco da Montegallo (1425 – 19 March 1496) was an Italian friar of the Order of Friars " +
    "Minor, known for founding pawnshops for the poor across Italy. His feast is celebrated on " +
    "20 March rather than on his death date of 19 March, the feast of Saint Joseph.";

  const REJECTED: Array<Case & { code: string }> = [
    {
      name: "Adolph Kolping",
      qid: "Q60619",
      statuses: BLESSED,
      feasts: "4 December",
      art: at("Adolph_Kolping"),
      lead:
        "Adolph Kolping (8 December 1813 – 4 December 1865) was a German Catholic priest and the " +
        "founder of the Kolping Association. He was beatified in 1991; his liturgical feast is " +
        "kept not on the day of his death but on 6 December.",
      infobox: {
        venerated_in: "Catholic Church",
        beatified_date: "27 October 1991",
        feast_day: "6 December",
      },
      code: "feast_contradicted",
    },
    {
      name: "Teresa Margaret Redi",
      qid: "Q168304",
      statuses: CATHOLIC_SAINT,
      feasts: "7 March",
      art: at("Teresa_Margaret_of_the_Sacred_Heart"),
      lead:
        "Teresa Margaret of the Sacred Heart (born Anna Maria Redi; 15 July 1747 – 7 March 1770) " +
        "was an Italian Discalced Carmelite nun revered for her mystical gifts. She was canonized " +
        "by Pope Pius XI in 1934.",
      infobox: {
        venerated_in: "Catholic Church",
        beatified_date: "9 June 1929",
        canonized_date: "19 March 1934",
        feast_day: "1 September",
      },
      code: "feast_contradicted",
    },
    {
      name: "René Goupil",
      qid: "Q1524650",
      statuses: CATHOLIC_SAINT,
      feasts: "29 September",
      art: at("Ren%C3%A9_Goupil"),
      lead:
        "René Goupil (15 May 1608 – 29 September 1642) was a French Jesuit lay missionary, the " +
        "first of the eight North American Martyrs to die and the first canonized Catholic martyr " +
        "of North America.",
      infobox: {
        venerated_in: "Roman Catholic Church",
        beatified_date: "21 June 1925",
        canonized_date: "29 June 1930",
        feast_day: "26 September (Canada); 19 October (United States)",
      },
      prose: "Goupil was killed on the Feast of St. Michael the Archangel, 29 September 1642.",
      code: "feast_contradicted",
    },
    {
      name: "Zdenka Cecília Schelingová",
      qid: "Q168952",
      statuses: BLESSED,
      feasts: "31 July",
      art: at("Cec%C3%ADlia_Schelingov%C3%A1"),
      lead:
        "Zdenka Cecília Schelingová (24 December 1916 – 31 July 1955) was a Slovak religious sister " +
        "of the Sisters of Charity of the Holy Cross who died after imprisonment by the communist " +
        "regime. She was beatified in Bratislava on 14 September 2003.",
      infobox: {
        venerated_in: "Roman Catholic Church",
        beatified_date: "14 September 2003",
        feast_day: "23 November",
      },
      code: "feast_contradicted",
    },
    {
      // Wikidata's day IS in the infobox — after another, as another rite's.
      name: "Eugendus",
      qid: "Q389249",
      statuses: CATHOLIC_SAINT,
      feasts: "1 January",
      art: at("Eugendus"),
      lead:
        "Eugendus (also Augendus; French: Oyand; c. 449 – January 1, 510) was the fourth abbot of " +
        "Condat Abbey, at Saint-Claude in the Jura, and is venerated as a saint.",
      infobox: {
        venerated_in: "Catholic Church; Eastern Orthodox Church",
        feast_day: "4 January (formerly 2 January); 1 January in the Eastern Orthodox Church",
      },
      code: "feast_ambiguous",
    },
    {
      name: "Luigi Beltrame Quattrocchi",
      qid: "Q13586473",
      statuses: BLESSED,
      feasts: "9 November",
      art: at("Luigi_Beltrame_Quattrocchi"),
      lead:
        "Luigi Beltrame Quattrocchi (12 January 1880 – 9 November 1951) and Maria Corsini were " +
        "married Italian Catholic laypeople, the first couple to be beatified together, in 2001. " +
        "Their feast is on 25 November, the anniversary of their wedding.",
      infobox: {
        venerated_in: "Catholic Church",
        beatified_date: "21 October 2001",
        feast_day: "25 November",
      },
      code: "feast_contradicted",
    },
    {
      // Feast wording sits right beside Wikidata's 19 March: only the
      // infobox-first rule — and the second date in the sentence — stop it.
      name: "Marco da Montegallo",
      qid: "Q15635147",
      statuses: BLESSED,
      feasts: "19 March",
      art: at("Marco_da_Montegallo"),
      lead: MONTEGALLO_LEAD,
      infobox: {
        venerated_in: "Roman Catholic Church",
        beatified_date: "20 September 1839",
        feast_day: "20 March",
      },
      code: "feast_contradicted",
    },
    {
      // The feast agrees; the stage does not. Wikidata carries both
      // "blessed" and "Catholic saint"; the article records the beatification.
      name: "Józef Cebula",
      qid: "Q475873",
      statuses: `${BLESSED}||${CATHOLIC_SAINT}`,
      feasts: "28 April",
      art: at("J%C3%B3zef_Cebula"),
      lead:
        "Józef Cebula (23 March 1902 – 9 May 1941) was a Polish priest of the Missionary Oblates " +
        "of Mary Immaculate, killed at the Mauthausen-Gusen concentration camp and beatified in " +
        "1999.",
      infobox: {
        venerated_in: "Roman Catholic Church",
        beatified_date: "13 June 1999",
        feast_day: "April 28",
      },
      code: "status_contradicted",
    },
  ];

  it.each(REJECTED)("rejects $name ($code)", async (c) => {
    expect(rejectionOf(await map(c))?.code).toBe(c.code);
  });

  it("refuses Montegallo's death date from the prose alone, too", () => {
    // Without the infobox, the second date in the sentence still decides.
    expect(feastStatedWithWording(3, 19, MONTEGALLO_LEAD, "en")).toBe(false);
    expect(feastStatedWithWording(3, 20, MONTEGALLO_LEAD, "en")).toBe(false);
  });

  it("refuses a feast the article says was moved (Ansfried of Utrecht)", async () => {
    const entry = await map({
      name: "Ansfried of Utrecht",
      qid: "Q569687",
      statuses: CATHOLIC_SAINT,
      feasts: "3 May",
      art: at("Ansfried_of_Utrecht"),
      lead:
        "Ansfried of Utrecht (died 3 May 1010 near Leusden) was Count of Huy and sword-bearer to " +
        "Otto I, and became Bishop of Utrecht in 995.",
      infobox: {},
      prose: "Veneration. His feast day was 3 May but was later moved to 11 May.",
    });
    expect(rejectionOf(entry)?.code).toBe("feast_uncorroborated");
  });

  const ACCEPTED: Array<Case & { status: string; feastDay: string; via: string }> = [
    {
      name: "Randoald",
      qid: "Q2130704",
      statuses: CATHOLIC_SAINT,
      feasts: "21 February",
      art: at("Randoald_of_Grandval"),
      lead:
        "Randoald (also Rancald or Randaut; died 21 February 675) was prior of the Benedictine " +
        "abbey of Moutier-Grandval under Germanus of Granfelden, venerated as a saint.",
      infobox: {
        venerated_in: "Eastern Orthodox Church; Roman Catholic Church",
        canonized_date: "Pre-congregation",
        feast_day: "21 February",
      },
      status: "canonized",
      feastDay: "02-21",
      via: "infobox",
    },
    {
      // A one-line {{Saint}} infobox with `honored_in` (see wikipedia-infobox).
      name: "Edward Colman",
      qid: "Q3579783",
      statuses: BLESSED,
      feasts: "3 December",
      art: at("Edward_Colman_(martyr)"),
      lead:
        "Edward Colman (17 May 1636 – 3 December 1678) was an English Catholic courtier under " +
        "Charles II, executed for treason during the Popish Plot and beatified in 1929.",
      infobox: {
        honored_in: "Roman Catholic Church",
        beatified_date: "15 December 1929 by Pope Pius XI",
        honorific_prefix: "Blessed",
        feast_day: "3 December",
      },
      status: "beatified",
      feastDay: "12-03",
      via: "{{Saint}} infobox",
    },
    {
      name: "Humphrey Middlemore",
      qid: "Q11938199",
      statuses: BLESSED,
      feasts: "19 June",
      art: at("Humphrey_Middlemore"),
      lead:
        "Humphrey Middlemore (died 19 June 1535) was an English Carthusian monk of the London " +
        "Charterhouse, executed under Henry VIII for refusing the Oath of Supremacy.",
      infobox: {
        honored_in: "Roman Catholic Church",
        beatified_date: "29 December 1886",
        honorific_prefix: "Blessed",
        feast_day: "19 June and 4 May",
      },
      status: "beatified",
      feastDay: "06-19",
      via: "infobox, first of two dates",
    },
    {
      // No infobox feast: the body states it, with feast wording and no
      // second date.
      name: "Randoald",
      qid: "Q2130704",
      statuses: CATHOLIC_SAINT,
      feasts: "21 February",
      art: at("Randoald_of_Grandval"),
      lead:
        "Randoald (also Rancald or Randaut; died 21 February 675) was prior of the Benedictine " +
        "abbey of Moutier-Grandval under Germanus of Granfelden, venerated as a saint.",
      infobox: {},
      prose: "Their feast day is 21 February, the anniversary of their deaths.",
      status: "canonized",
      feastDay: "02-21",
      via: "article body",
    },
  ];

  it.each(ACCEPTED)("still publishes $name on $feastDay (from the $via)", async (c) => {
    const entry = await map(c);
    expect(rejectionOf(entry)).toBeNull();
    const payload = (entry as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({ canonizationStatus: c.status, feastDay: c.feastDay });
    expect(validatePayload("SAINT", payload).ok).toBe(true);
  });
});

describe("a one-line REST summary falls back to the whole introduction", () => {
  // Gaugericus (Q585739), 2026-10-31: the REST summary — the first paragraph,
  // parentheses removed — is 71 characters; the article's introduction is a
  // full paragraph, and its infobox's first feast is Wikidata's 11 August.
  const GAUGERICUS = {
    s: `${WD}Q585739`,
    label: "Gaugericus",
    statuses: CATHOLIC_SAINT,
    feasts: "11 August",
    art: "https://en.wikipedia.org/wiki/Gaugericus",
  };
  const SUMMARY = "Saint Gaugericus was the bishop of Cambrai-Arras in the seventh century.";
  const INTRO =
    "Saint Gaugericus (Géry; c. 550 – 11 August 626) was the bishop of Cambrai-Arras in the " +
    "seventh century. He founded a monastery on an island in the Senne, around which the city " +
    "of Brussels grew.";

  it("publishes from the introduction, credited to the same article", async () => {
    mockedSummary.mockResolvedValue({ extract: SUMMARY, url: GAUGERICUS.art, lang: "en" });
    mockedIntro.mockResolvedValue(INTRO);
    mockedInfobox.mockResolvedValue({
      venerated_in: "Roman Catholic Church",
      feast_day: "11 August; 18 November (translation of relics)",
    });
    const entry = await saintMap(row(GAUGERICUS));
    expect(rejectionOf(entry)).toBeNull();
    expect(entry).toMatchObject({
      payload: {
        biography: INTRO,
        feastDay: "08-11",
        provenance: { biography: "wikipedia", article: GAUGERICUS.art },
      },
    });
    expect(mockedIntro).toHaveBeenCalledWith(GAUGERICUS.art, expect.anything());
  });

  it("still refuses a saint whose introduction is as thin as the summary", async () => {
    mockedSummary.mockResolvedValue({ extract: SUMMARY, url: GAUGERICUS.art, lang: "en" });
    mockedIntro.mockResolvedValue("Gaugericus was a bishop.");
    expect(rejectionOf(await saintMap(row(GAUGERICUS)))?.code).toBe("description_too_short");
  });

  it("never spends the extra request when the summary is long enough", async () => {
    mockedSummary.mockResolvedValue({ extract: INTRO, url: GAUGERICUS.art, lang: "en" });
    mockedInfobox.mockResolvedValue({ feast_day: "11 August" });
    expect(rejectionOf(await saintMap(row(GAUGERICUS)))).toBeNull();
    expect(mockedIntro).not.toHaveBeenCalled();
  });
});
