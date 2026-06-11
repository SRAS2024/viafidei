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

import { validatePayload } from "@/lib/checklist";
import { ingestorFor } from "@/lib/admin-worker/structured/ingestors";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);

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
