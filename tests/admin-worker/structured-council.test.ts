/**
 * The COUNCIL ingestor grows the ecumenical councils of the Catholic Church
 * (Nicaea → Vatican II) as `council_document` records from Wikidata + a cited
 * Wikipedia abstract, so the Church-history timeline fills with the great
 * councils. These tests pin its accuracy contract: it produces a record that
 * passes the REAL church-document schema, keeps the historically certain
 * inception year (using a Jan-1 placeholder only when the source records mere
 * year precision — never a fabricated exact day), and skips an undated or
 * unsourced council.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
}));

import { validatePayload } from "@/lib/checklist";
import { STRUCTURED_INGESTORS } from "@/lib/admin-worker/structured/ingestors";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);

const VATICAN_II =
  "The Second Vatican Council was the 21st ecumenical council of the Catholic Church, opened by " +
  "Pope John XXIII in 1962 and closed under Pope Paul VI in 1965; it addressed relations between " +
  "the Church and the modern world across sixteen documents.";

beforeEach(() => mockedSummary.mockReset());
afterEach(() => vi.restoreAllMocks());

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}
const councilMap = (r: SparqlBinding) =>
  STRUCTURED_INGESTORS.find((i) => i.id === "wikidata-councils")!.map(
    r,
    {} as Record<string, never>,
  );

describe("COUNCIL ingestor", () => {
  it("maps a council to a schema-valid council_document, keeping a day-precision date", async () => {
    mockedSummary.mockResolvedValue({
      extract: VATICAN_II,
      url: "https://en.wikipedia.org/wiki/Second_Vatican_Council",
    } as never);

    const entry = await councilMap(
      row({
        c: "http://www.wikidata.org/entity/Q21196",
        label: "Second Vatican Council",
        inception: "+1962-10-11T00:00:00Z",
        precision: "11",
        art: "https://en.wikipedia.org/wiki/Second_Vatican_Council",
      }),
    );

    expect(entry).not.toBeNull();
    expect(entry!.payload.documentType).toBe("council_document");
    expect(entry!.payload.issuedDate).toBe("1962-10-11");
    expect(entry!.payload.title).toBe("Second Vatican Council");
    expect(entry!.citations.length).toBeGreaterThanOrEqual(2);
    expect(validatePayload("CHURCH_DOCUMENT", entry!.payload).ok).toBe(true);
  });

  it("keeps only the certain year (Jan-1 placeholder) for a year-precision council", async () => {
    mockedSummary.mockResolvedValue({
      extract:
        "The First Council of Nicaea was a council of Christian bishops convened in the Bithynian " +
        "city of Nicaea in 325; it produced the original Nicene Creed and condemned Arianism.",
      url: "https://en.wikipedia.org/wiki/First_Council_of_Nicaea",
    } as never);

    const entry = await councilMap(
      row({
        c: "http://www.wikidata.org/entity/Q51530",
        label: "First Council of Nicaea",
        inception: "+0325-01-01T00:00:00Z",
        precision: "9",
        art: "https://en.wikipedia.org/wiki/First_Council_of_Nicaea",
      }),
    );

    expect(entry).not.toBeNull();
    expect(entry!.payload.issuedDate).toBe("0325-01-01");
    expect(validatePayload("CHURCH_DOCUMENT", entry!.payload).ok).toBe(true);
  });

  it("skips a council with no inception date", async () => {
    const entry = await councilMap(
      row({ c: "http://www.wikidata.org/entity/Q1", label: "Some Council" }),
    );
    expect(entry).toBeNull();
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("skips a council whose Wikipedia summary is too short to be a real description", async () => {
    mockedSummary.mockResolvedValue({
      extract: "A council.",
      url: "https://en.wikipedia.org/wiki/X",
    } as never);
    const entry = await councilMap(
      row({
        c: "http://www.wikidata.org/entity/Q2",
        label: "Tiny Council",
        inception: "+1100-01-01T00:00:00Z",
        precision: "9",
        art: "https://en.wikipedia.org/wiki/X",
      }),
    );
    expect(entry).toBeNull();
  });
});
