/**
 * Wikipedia text is CC BY-SA 4.0: a page that quotes an article must credit it
 * (link + licence). These tests pin WHICH published items get the credit line —
 * every one whose shown prose came from Wikipedia, explicitly (provenance) or
 * by the structured ingest's own shape — and that hand-written or composed
 * prose is never credited to Wikipedia.
 */
import { describe, expect, it } from "vitest";

import {
  parseWikipediaArticle,
  wikipediaEditionName,
  wikipediaTextSource,
} from "@/lib/content-shared/wikipedia-attribution";

const WD = "https://www.wikidata.org/wiki/Q78679";
const EN = "https://en.wikipedia.org/wiki/Hildegard_Burjan";
const BIO = "Hildegard Burjan was an Austrian politician and the founder of a sisterhood.";

describe("wikipediaTextSource", () => {
  it("credits a live structured saint (legacy shape: Wikidata + Wikipedia citations)", () => {
    expect(wikipediaTextSource("SAINT", { biography: BIO, citations: [WD, EN] })).toEqual({
      url: EN,
      title: "Hildegard Burjan",
      lang: "en",
    });
  });

  it("credits from explicit provenance written by the ingest", () => {
    const itwiki = "https://it.wikipedia.org/wiki/Giuseppe_Marello";
    expect(
      wikipediaTextSource("SAINT", {
        biography: BIO,
        citations: [WD, itwiki],
        provenance: { biography: "wikipedia", article: itwiki },
      }),
    ).toMatchObject({ title: "Giuseppe Marello", lang: "it" });
  });

  it("never credits a COMPOSED biography", () => {
    expect(
      wikipediaTextSource("SAINT", {
        biography: "Eutichius was a christian martyr. The Catholic Church venerates…",
        citations: [WD, "https://it.wikipedia.org/wiki/Eutichio"],
        provenance: { biography: "structured-facts", articleLanguage: "it" },
      }),
    ).toBeNull();
  });

  it("never credits a hand-written curated entry that merely cites Wikipedia", () => {
    // The curated councils cite their Wikipedia article but carry their own summary.
    expect(
      wikipediaTextSource("CHURCH_DOCUMENT", {
        summary: "The First Council of Nicaea defined the divinity of the Son.",
        citations: ["https://en.wikipedia.org/wiki/First_Council_of_Nicaea"],
      }),
    ).toBeNull();
  });

  it("credits the other structured types whose narrative is always the article", () => {
    const art = "https://en.wikipedia.org/wiki/Pope_Linus";
    expect(
      wikipediaTextSource("POPE", { background: "Linus was…", citations: [WD, art] }),
    ).not.toBeNull();
    // A pope whose summary fetch failed carries the citation but no quoted text.
    expect(
      wikipediaTextSource("POPE", { summary: "Pope Linus, who…", citations: [WD, art] }),
    ).toBeNull();
  });

  it("credits a descriptive type only when the article was its only narrative source", () => {
    const art = "https://en.wikipedia.org/wiki/Brown_Scapular";
    const site = "https://www.carmelites.org/scapular";
    expect(
      wikipediaTextSource("DEVOTION", { background: "The scapular…", citations: [WD, art] }),
    ).not.toBeNull();
    expect(
      wikipediaTextSource("DEVOTION", {
        background: "The scapular…",
        citations: [WD, site, art],
      }),
    ).toBeNull();
  });

  it("is null for content with no Wikipedia text at all", () => {
    expect(wikipediaTextSource("PRAYER", { text: "Our Father…", citations: [] })).toBeNull();
    expect(wikipediaTextSource("SAINT", { biography: BIO })).toBeNull();
  });
});

describe("credit line parts", () => {
  it("reads the title from the article URL", () => {
    expect(parseWikipediaArticle("https://en.wikipedia.org/wiki/J%C3%B3zef_Cebula")?.title).toBe(
      "Józef Cebula",
    );
    expect(parseWikipediaArticle("https://example.org/wiki/X")).toBeNull();
  });

  it("names the edition", () => {
    expect(wikipediaEditionName("en")).toBe("Wikipedia");
    expect(wikipediaEditionName("it")).toBe("Italian Wikipedia");
  });
});
