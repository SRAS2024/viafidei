/**
 * The ecumenical councils on the Church-history timeline come from the CURATED
 * knowledge base, not from a structured ingestor. The Wikidata council
 * ingestor could never publish: it required an inception date (P571) that only
 * Vatican I carries, all twenty-one councils are already curated, and loosening
 * the query would have created duplicates under Wikidata's differing labels
 * ("First Council of Ephesus" vs the curated "council-of-ephesus"). These tests
 * pin that it stays unregistered and that the curated set is complete, so the
 * timeline does not depend on a source that cannot deliver.
 */
import { describe, expect, it } from "vitest";

import { STRUCTURED_INGESTORS, ingestorFor } from "@/lib/admin-worker/structured/ingestors";
import { churchHistoryKnowledge } from "@/lib/checklist/knowledge/church-history";

describe("councils: curated, not structured-ingested", () => {
  it("registers no council ingestor (it could never publish)", () => {
    expect(STRUCTURED_INGESTORS.find((i) => i.id === "wikidata-councils")).toBeUndefined();
    // CHURCH_DOCUMENT still has exactly one ingestor: the documents one.
    const docIngestors = STRUCTURED_INGESTORS.filter((i) => i.contentType === "CHURCH_DOCUMENT");
    expect(docIngestors.map((i) => i.id)).toEqual(["wikidata-church-documents"]);
    expect(ingestorFor("CHURCH_DOCUMENT")?.id).toBe("wikidata-church-documents");
  });

  it("the curated knowledge carries all twenty-one ecumenical councils with distinct slugs", () => {
    const councils = churchHistoryKnowledge.filter(
      (e) => e.contentType === "CHURCH_DOCUMENT" && e.payload.documentType === "council_document",
    );
    expect(councils).toHaveLength(21);
    expect(new Set(councils.map((c) => c.slug)).size).toBe(21);
    const slugs = councils.map((c) => c.slug);
    expect(slugs).toContain("first-council-of-nicaea");
    expect(slugs).toContain("council-of-ephesus");
    expect(slugs).toContain("first-vatican-council");
    expect(slugs).toContain("second-vatican-council");
  });
});
