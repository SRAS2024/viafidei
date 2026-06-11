/**
 * The CHURCH_DOCUMENT ingestor catalogs official Church documents (encyclicals,
 * exhortations, …) from Wikidata's bibliographic facts plus a cited Wikipedia
 * summary. These tests pin: the document-type mapping, a record that passes the
 * REAL church-document schema, and the skip paths that keep it from publishing
 * anything incomplete (unknown type, malformed date, missing canonical URL /
 * themes / article / a too-short summary).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
}));

import { validatePayload } from "@/lib/checklist";
import { ingestorFor, mapDocumentType } from "@/lib/admin-worker/structured/ingestors";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);

const EXTRACT =
  "Rerum novarum is an encyclical issued by Pope Leo XIII in 1891 on the conditions of labour, " +
  "addressing the rights and duties of capital and labour and the proper role of the state.";

function docMap(row: SparqlBinding) {
  return ingestorFor("CHURCH_DOCUMENT")!.map(row, {} as Record<string, never>);
}

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

const FULL = {
  doc: "http://www.wikidata.org/entity/Q623270",
  label: "Rerum novarum",
  types: "encyclical||written work",
  author: "Pope Leo XIII",
  pubDate: "1891-05-15T00:00:00Z",
  canon:
    "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_15051891_rerum-novarum.html",
  themes: "Catholic social teaching||labour rights||capitalism",
  art: "https://en.wikipedia.org/wiki/Rerum_novarum",
};

beforeEach(() => {
  mockedSummary.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("mapDocumentType", () => {
  it("maps known instance-of labels", () => {
    expect(mapDocumentType("encyclical||written work")).toBe("encyclical");
    expect(mapDocumentType("apostolic exhortation")).toBe("apostolic_exhortation");
    expect(mapDocumentType("motu proprio")).toBe("motu_proprio");
    expect(mapDocumentType("papal decree")).toBe("decree");
  });
  it("returns null for an unmapped type", () => {
    expect(mapDocumentType("papal bull")).toBeNull();
    expect(mapDocumentType("")).toBeNull();
  });
});

describe("CHURCH_DOCUMENT ingestor mapping", () => {
  it("maps a full row to a SCHEMA-VALID church-document entry", async () => {
    mockedSummary.mockResolvedValue({ extract: EXTRACT, url: FULL.art });
    const entry = await docMap(row(FULL));
    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("rerum-novarum");
    expect(entry!.payload.documentType).toBe("encyclical");
    expect(entry!.payload.issuedDate).toBe("1891-05-15");
    expect(entry!.payload.issuingAuthority).toBe("Pope Leo XIII");
    expect(entry!.payload.keyThemes).toEqual([
      "Catholic social teaching",
      "labour rights",
      "capitalism",
    ]);
    expect(entry!.payload.canonicalUrl).toContain("vatican.va");
    expect(validatePayload("CHURCH_DOCUMENT", entry!.payload).ok).toBe(true);
  });

  it("SKIPS an unmapped document type", async () => {
    mockedSummary.mockResolvedValue({ extract: EXTRACT, url: FULL.art });
    expect(await docMap(row({ ...FULL, types: "papal bull" }))).toBeNull();
  });

  it("SKIPS a malformed issued date", async () => {
    mockedSummary.mockResolvedValue({ extract: EXTRACT, url: FULL.art });
    expect(await docMap(row({ ...FULL, pubDate: "1891" }))).toBeNull();
  });

  it("SKIPS when the canonical URL or themes are missing", async () => {
    mockedSummary.mockResolvedValue({ extract: EXTRACT, url: FULL.art });
    const { canon: _c, ...noCanon } = FULL;
    void _c;
    expect(await docMap(row(noCanon))).toBeNull();
    const { themes: _t, ...noThemes } = FULL;
    void _t;
    expect(await docMap(row(noThemes))).toBeNull();
  });

  it("SKIPS when the summary is missing or too short", async () => {
    mockedSummary.mockResolvedValue(null);
    expect(await docMap(row(FULL))).toBeNull();
    mockedSummary.mockResolvedValue({ extract: "short", url: FULL.art });
    expect(await docMap(row(FULL))).toBeNull();
  });
});
