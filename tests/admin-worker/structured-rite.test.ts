/**
 * The RITE ingestor grows the recognized Catholic rites + Eastern Catholic
 * Churches sui iuris automatically from Wikidata + a cited Wikipedia abstract.
 * These tests pin its accuracy contract: it produces a record that passes the
 * REAL rite schema, requires a sourced description (skips a bare name), and emits
 * a CORE slug that lines up with the curated convention so it never duplicates a
 * rite that is already published.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
}));

import { validatePayload } from "@/lib/checklist";
import { ingestorFor, riteCoreSlug } from "@/lib/admin-worker/structured/ingestors";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);

const DESC =
  "The Maronite Church is an Eastern Catholic sui iuris particular church in full communion " +
  "with the Pope and the Catholic Church, with self-governance under the Code of Canons of the " +
  "Eastern Churches.";

beforeEach(() => mockedSummary.mockReset());
afterEach(() => vi.restoreAllMocks());

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}
const riteMap = (r: SparqlBinding) => ingestorFor("RITE")!.map(r, {} as Record<string, never>);

describe("riteCoreSlug — curated-convention alignment", () => {
  it("collapses generic rite/church words so structured slugs match curated ones", () => {
    expect(riteCoreSlug("Roman Rite")).toBe("roman");
    expect(riteCoreSlug("Byzantine Rite")).toBe("byzantine");
    expect(riteCoreSlug("Syro-Malabar Catholic Church")).toBe("syro-malabar");
    expect(riteCoreSlug("Ukrainian Greek Catholic Church")).toBe("ukrainian");
  });
  it("keeps a genuinely new sui iuris church distinct", () => {
    expect(riteCoreSlug("Italo-Albanian Catholic Church")).toBe("italo-albanian");
    expect(riteCoreSlug("Romanian Greek Catholic Church")).toBe("romanian");
  });
});

describe("RITE ingestor", () => {
  it("produces a schema-valid rite with a cited description and an aligned slug", async () => {
    mockedSummary.mockResolvedValue({
      extract: DESC,
      url: "https://en.wikipedia.org/wiki/Maronite_Church",
    } as never);

    const entry = await riteMap(
      row({
        r: "http://www.wikidata.org/entity/Q827468",
        label: "Maronite Church",
        art: "https://en.wikipedia.org/wiki/Maronite_Church",
      }),
    );

    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("rite-maronite"); // matches the curated convention
    expect(entry!.payload.title).toBe("Maronite Church");
    expect(entry!.citations.length).toBe(2);
    expect(validatePayload("RITE", entry!.payload).ok).toBe(true);
  });

  it("skips a rite with no Wikipedia article (no sourced description)", async () => {
    const entry = await riteMap(
      row({ r: "http://www.wikidata.org/entity/Q1", label: "Some Rite" }),
    );
    expect(entry).toBeNull();
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("skips when the article summary is too short to be a real description", async () => {
    mockedSummary.mockResolvedValue({
      extract: "A rite.",
      url: "https://en.wikipedia.org/wiki/X",
    } as never);
    const entry = await riteMap(
      row({
        r: "http://www.wikidata.org/entity/Q2",
        label: "Tiny Rite",
        art: "https://en.wikipedia.org/wiki/X",
      }),
    );
    expect(entry).toBeNull();
  });
});
