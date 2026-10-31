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
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { fetchArticleInfobox } from "@/lib/admin-worker/structured/wikipedia-infobox";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedInfobox = vi.mocked(fetchArticleInfobox);

function setProse(text: string): void {
  (globalThis as { __saintProse?: string }).__saintProse = text;
}

beforeEach(() => {
  mockedSummary.mockReset();
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
  s: `${WD}Q69389`,
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
    s: `${WD}Q5348390`,
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
