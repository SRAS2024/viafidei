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

const FULL = {
  s: "http://www.wikidata.org/entity/Q170145",
  label: "Rose of Lima",
  status: "saint",
  feastName: "23 August",
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
    expect(entry!.citations).toHaveLength(2);
    expect(validatePayload("SAINT", entry!.payload).ok).toBe(true);
  });

  it("SKIPS when the feast day is not corroborated in the article text", async () => {
    mockedSummary.mockResolvedValue({
      extract:
        "Saint Rose of Lima was a Peruvian Dominican tertiary venerated across the Americas for her holiness.",
      url: "https://en.wikipedia.org/wiki/Rose_of_Lima",
    });
    expect(await saintMap(row(FULL))).toBeNull();
  });

  it("SKIPS an unknown canonization status without fetching anything", async () => {
    const entry = await saintMap(row({ ...FULL, status: "pope" }));
    expect(entry).toBeNull();
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("SKIPS when there is no Wikipedia article", async () => {
    const { art: _art, ...noArticle } = FULL;
    void _art;
    expect(await saintMap(row(noArticle))).toBeNull();
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("SKIPS when the biography is too short for the schema", async () => {
    mockedSummary.mockResolvedValue({ extract: "Too short.", url: FULL.art });
    expect(await saintMap(row(FULL))).toBeNull();
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

    expect(await saintMap(row(FULL))).toBeNull();
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
