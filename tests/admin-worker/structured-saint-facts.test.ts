/**
 * The structured saint facts are the accuracy core of the SAINT ingest and the
 * published-saint repair: canonization status is resolved from Wikidata ITEMS
 * (never a label substring, which published Orthodox / Anglican / folk saints
 * as Catholic `canonized`), a multi-valued status resolves to the highest
 * rank, the saint type comes from positions / occupations / awards (never
 * "apostle" / "pope" / "virgin" from prose), the display title carries the
 * honorific the status earns, and an unpublish is only ever justified by
 * PROOF of non-Catholic veneration — doubt leaves a record alone.
 */
import { describe, expect, it } from "vitest";

import {
  feastMentionIndex,
  feastMentionIndexLocalized,
} from "@/lib/admin-worker/structured/corroboration";
import {
  composeStructuredBiography,
  deriveSaintType,
  isProvenNonCatholic,
  parseSaintFacts,
  resolveCanonizationStatus,
  saintDisplayTitle,
  type SaintFacts,
} from "@/lib/admin-worker/structured/saint-facts";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const WD = "http://www.wikidata.org/entity/";

function facts(over: Partial<SaintFacts> = {}): SaintFacts {
  return {
    qid: "Q1",
    entityUri: `${WD}Q1`,
    label: "Test Saint",
    description: null,
    feasts: [],
    statuses: [],
    religions: [],
    religionLabels: [],
    positions: [],
    occupations: [],
    awards: [],
    bishopSee: false,
    founded: false,
    birthYear: null,
    deathYear: null,
    enArticle: null,
    altArticles: [],
    website: null,
    ...over,
  };
}

const CATHOLIC_SAINT = "Q3464126";
const BLESSED = "Q2369287";
const VENERABLE = "Q51619";
const GENERIC_SAINT = "Q43115";
const THE_VENERABLE_ORTHODOX = "Q12774503";
const CATHOLIC_CHURCH = "Q9592";
const EASTERN_ORTHODOXY = "Q3333484";

describe("resolveCanonizationStatus (by QID, never by label)", () => {
  it("accepts a Catholic-specific status item regardless of religion", () => {
    expect(resolveCanonizationStatus(facts({ statuses: [CATHOLIC_SAINT] }))?.status).toBe(
      "canonized",
    );
    expect(
      resolveCanonizationStatus(
        facts({ statuses: [CATHOLIC_SAINT], religions: [EASTERN_ORTHODOXY] }),
      )?.status,
    ).toBe("canonized");
  });

  it("accepts the generic 'saint' ONLY with a Catholic religion", () => {
    expect(resolveCanonizationStatus(facts({ statuses: [GENERIC_SAINT] }))).toBeNull();
    expect(
      resolveCanonizationStatus(
        facts({ statuses: [GENERIC_SAINT], religions: [EASTERN_ORTHODOXY] }),
      ),
    ).toBeNull();
    const r = resolveCanonizationStatus(
      facts({ statuses: [GENERIC_SAINT], religions: [CATHOLIC_CHURCH] }),
    );
    expect(r).toEqual({ status: "canonized", basis: "generic-saint-catholic-religion" });
  });

  it("resolves multi-valued P411 to the HIGHEST rank", () => {
    expect(resolveCanonizationStatus(facts({ statuses: [BLESSED, CATHOLIC_SAINT] }))?.status).toBe(
      "canonized",
    );
    expect(resolveCanonizationStatus(facts({ statuses: [VENERABLE, BLESSED] }))?.status).toBe(
      "beatified",
    );
  });

  it("never maps the Orthodox honorific 'The Venerable' to the Catholic stage", () => {
    expect(resolveCanonizationStatus(facts({ statuses: [THE_VENERABLE_ORTHODOX] }))).toBeNull();
    // The shared "Venerable" item counts only when the record isn't Orthodox-only.
    expect(
      resolveCanonizationStatus(facts({ statuses: [VENERABLE], religions: [EASTERN_ORTHODOXY] })),
    ).toBeNull();
    expect(resolveCanonizationStatus(facts({ statuses: [VENERABLE] }))?.status).toBe("venerable");
  });

  it("recognises a Catholic religion by label when the QID is not enumerated", () => {
    expect(
      resolveCanonizationStatus(
        facts({ statuses: [GENERIC_SAINT], religions: ["Q999"], religionLabels: ["Catholic Church in Peru"] }),
      )?.status,
    ).toBe("canonized");
  });
});

describe("isProvenNonCatholic (the only unpublish condition)", () => {
  it("is true only with explicit proof and no Catholic signal", () => {
    expect(isProvenNonCatholic(facts({ statuses: [THE_VENERABLE_ORTHODOX] }))).toBe(true);
    expect(
      isProvenNonCatholic(facts({ statuses: [GENERIC_SAINT], religions: [EASTERN_ORTHODOXY] })),
    ).toBe(true);
    expect(
      isProvenNonCatholic(
        facts({ statuses: [GENERIC_SAINT], religionLabels: ["Georgian Orthodox Church"] }),
      ),
    ).toBe(true);
  });

  it("is false on doubt (generic status, no religion) and whenever anything Catholic is present", () => {
    expect(isProvenNonCatholic(facts({ statuses: [GENERIC_SAINT] }))).toBe(false);
    expect(isProvenNonCatholic(facts({ statuses: [] }))).toBe(false);
    expect(
      isProvenNonCatholic(facts({ statuses: [CATHOLIC_SAINT], religions: [EASTERN_ORTHODOXY] })),
    ).toBe(false);
    expect(
      isProvenNonCatholic(
        facts({ statuses: [THE_VENERABLE_ORTHODOX], religions: [CATHOLIC_CHURCH] }),
      ),
    ).toBe(false);
  });
});

describe("deriveSaintType (structured first, prose only for martyr / doctor)", () => {
  it("never labels a saint 'apostle' from an 'Apostle of …' honorific in prose", () => {
    // St Patrick: bishop by P39, died 461, abstract calls him "Apostle of Ireland".
    const patrick = facts({ positions: ["Q29182"], deathYear: 461 });
    expect(
      deriveSaintType(patrick, {
        abstract: 'Saint Patrick was a Christian missionary and bishop known as the "Apostle of Ireland".',
      }),
    ).toBe("bishop");
    // Even the apostle POSITION needs an apostolic-age death year.
    expect(deriveSaintType(facts({ positions: ["Q43412"], deathYear: 1552 }))).toBe("other");
    expect(deriveSaintType(facts({ positions: ["Q43412"], deathYear: 64 }))).toBe("apostle");
  });

  it("derives 'pope' from the position held, never from 'canonized by Pope …'", () => {
    expect(deriveSaintType(facts({ positions: ["Q19546"] }))).toBe("pope");
    expect(
      deriveSaintType(facts(), {
        abstract: "She was a Polish nun canonized by Pope John Paul II in 2000.",
      }),
    ).toBe("religious");
  });

  it("never derives 'virgin' from prose that merely mentions the Virgin Mary", () => {
    // St John Vianney: priest by occupation; abstract mentions the Virgin.
    expect(
      deriveSaintType(facts({ occupations: ["Q250867"] }), {
        abstract: "John Vianney was a French Catholic priest devoted to the Virgin Mary.",
      }),
    ).toBe("religious");
    // The infobox `titles` field and the consecrated-virgin status DO count.
    expect(deriveSaintType(facts(), { infoboxTitles: "Virgin and Martyr" })).toBe("martyr");
    expect(deriveSaintType(facts(), { infoboxTitles: "Virgin" })).toBe("virgin");
    expect(deriveSaintType(facts({ statuses: ["Q1520404"] }))).toBe("virgin");
  });

  it("reads martyr / doctor from structured data or the unambiguous phrases", () => {
    expect(deriveSaintType(facts({ occupations: ["Q107013"] }))).toBe("martyr");
    expect(
      deriveSaintType(facts(), { abstract: "Agnes of Rome was a virgin martyr. Later text." }),
    ).toBe("martyr");
    expect(deriveSaintType(facts({ awards: ["Q192499"] }))).toBe("doctor_of_the_church");
    expect(deriveSaintType(facts({ positions: ["Q19546"] }), { abstract: "He was a Doctor of the Church." })).toBe(
      "doctor_of_the_church",
    );
  });

  it("falls back to the always-valid 'other'", () => {
    expect(deriveSaintType(facts())).toBe("other");
  });
});

describe("saintDisplayTitle", () => {
  it("prefixes the honorific the status earns unless one is already there", () => {
    expect(saintDisplayTitle("Rose of Lima", "canonized")).toBe("Saint Rose of Lima");
    expect(saintDisplayTitle("Anne of Saint Bartholomew", "beatified")).toBe(
      "Blessed Anne of Saint Bartholomew",
    );
    expect(saintDisplayTitle("Fulton Sheen", "venerable")).toBe("Venerable Fulton Sheen");
    expect(saintDisplayTitle("Dorothy Day", "servant_of_god")).toBe("Servant of God Dorothy Day");
    expect(saintDisplayTitle("St. Patrick", "canonized")).toBe("St. Patrick");
    expect(saintDisplayTitle("Pope Pius X", "canonized")).toBe("Pope Pius X");
  });
});

describe("parseSaintFacts", () => {
  it("parses the GROUP_CONCAT lists and skips a bare-QID label", () => {
    const row: SparqlBinding = {
      s: { type: "uri", value: `${WD}Q170145` },
      label: { type: "literal", value: "Rose of Lima" },
      statuses: { type: "literal", value: `${WD}Q2369287||${WD}Q3464126` },
      feasts: { type: "literal", value: "23 August||30 August" },
      died: { type: "literal", value: "1617-08-24T00:00:00Z" },
      altArts: { type: "literal", value: "https://es.wikipedia.org/wiki/Rosa_de_Lima" },
    };
    const f = parseSaintFacts(row)!;
    expect(f.qid).toBe("Q170145");
    expect(f.statuses).toEqual(["Q2369287", "Q3464126"]);
    expect(f.feasts).toEqual(["23 August", "30 August"]);
    expect(f.deathYear).toBe(1617);
    expect(f.enArticle).toBeNull();
    expect(f.altArticles).toEqual(["https://es.wikipedia.org/wiki/Rosa_de_Lima"]);
    expect(parseSaintFacts({ ...row, label: { type: "literal", value: "Q170145" } })).toBeNull();
  });
});

describe("composeStructuredBiography (non-English article branch)", () => {
  it("composes an English biography from the cited facts only", () => {
    const text = composeStructuredBiography({
      facts: facts({
        label: "Bartolomea Capitanio",
        description: "Italian Roman Catholic nun and saint",
        birthYear: 1807,
        deathYear: 1833,
      }),
      status: "canonized",
      feastText: "July 26",
      articleLang: "it",
    })!;
    expect(text).toContain("Bartolomea Capitanio (1807–1833) was an Italian Roman Catholic nun");
    expect(text).toContain("as a saint");
    expect(text).toContain("July 26");
    expect(text).toContain("Italian-language Wikipedia");
  });

  it("returns null without a description to build on", () => {
    expect(
      composeStructuredBiography({
        facts: facts({ description: "saint" }),
        status: "canonized",
        feastText: "July 26",
        articleLang: "it",
      }),
    ).toBeNull();
  });
});

describe("feastMentionIndex (position decides a multi-feast saint)", () => {
  it("reports WHERE each date is stated so the infobox-first rule can order them", () => {
    const infobox = "28 January; 7 March (pre-1969 calendar)";
    expect(feastMentionIndex(1, 28, infobox)).toBe(0);
    expect(feastMentionIndex(3, 7, infobox)).toBe(12);
    expect(feastMentionIndex(8, 23, infobox)).toBe(-1);
    expect(feastMentionIndex(3, 7, "March 7th and 28 January")).toBe(0);
  });

  it("does the same in the supported non-English editions", () => {
    expect(feastMentionIndexLocalized(7, 14, "festa: 14 luglio; 1 agosto", "it")).toBe(7);
    expect(feastMentionIndexLocalized(8, 1, "festa: 14 luglio; 1 agosto", "it")).toBe(18);
    expect(feastMentionIndexLocalized(7, 14, "14 de julio", "es")).toBe(0);
    expect(feastMentionIndexLocalized(7, 14, "14. Juli", "de")).toBe(0);
    expect(feastMentionIndexLocalized(7, 14, "14 lipca", "pl")).toBe(0);
    expect(feastMentionIndexLocalized(7, 14, "14 July", "xx")).toBe(-1);
  });
});
