/**
 * Section 8 — Apparition, Devotion, Sacrament, History, Liturgy, Parish
 * extractor tests. Verifies each produces a complete typed package
 * from representative source text and rejects wrong-content patterns.
 */

import { describe, expect, it } from "vitest";
import { extractApparition } from "@/lib/content-qa/extractors/apparition";
import { extractDevotion } from "@/lib/content-qa/extractors/devotion";
import { extractSacrament } from "@/lib/content-qa/extractors/sacrament";
import { extractHistory } from "@/lib/content-qa/extractors/history";
import { extractLiturgy } from "@/lib/content-qa/extractors/liturgy";
import { extractParish } from "@/lib/content-qa/extractors/parish";

describe("extractApparition", () => {
  it("extracts Lourdes with known location + approval status", () => {
    const result = extractApparition({
      title: "Our Lady of Lourdes",
      body: "In 1858, the Blessed Virgin Mary appeared eighteen times to Saint Bernadette Soubirous in Lourdes, France. The apparitions were officially approved by the bishop in 1862. Feast day: February 11.",
      sourceUrl: "https://www.vatican.va/lourdes",
    });
    expect(result.complete).toBe(true);
    expect(result.payload.apparitionName).toBe("Our Lady of Lourdes");
    expect(result.payload.location).toBe("Lourdes");
    expect(result.payload.country).toBe("France");
    expect(result.payload.approvalStatus).toBe("Approved");
    expect(result.payload.feastDay).toBe("February 11");
  });

  it("flags missing location for an unknown apparition", () => {
    const result = extractApparition({
      title: "Apparition in some village",
      body: "An apparition occurred. No further details available.",
    });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toContain("location");
    expect(result.missingFields).toContain("country");
  });
});

describe("extractDevotion", () => {
  it("extracts a Sacred Heart devotion with practice instructions", () => {
    const result = extractDevotion({
      title: "Devotion to the Sacred Heart",
      body: "The Devotion to the Sacred Heart is a major Catholic devotion centered on the love of Jesus Christ. The faithful are encouraged to pray daily before an image of the Sacred Heart.\n\nHow to pray: Begin by making the Sign of the Cross. Then recite the prayer to the Sacred Heart. Conclude with the Our Father.\n\nDuration: 15 minutes.",
    });
    expect(result.complete).toBe(true);
    expect(result.payload.devotionType).toBe("Devotion to the Sacred Heart");
    expect(result.payload.practiceInstructions).toMatch(/Sign\s+of\s+the\s+Cross/);
    expect(result.payload.duration).toBe(15);
  });

  it("flags missing practiceInstructions when only background is present", () => {
    const result = extractDevotion({
      title: "Some devotion",
      body: "This is a Catholic devotion to Jesus, with rich tradition rooted in centuries of practice.",
    });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toContain("practiceInstructions");
  });
});

describe("extractSacrament", () => {
  it("extracts the Eucharist with CCC refs", () => {
    const result = extractSacrament({
      title: "The Eucharist",
      body: "The Eucharist is the source and summit of the Christian life. It is the real presence of Jesus Christ in the consecrated bread and wine. CCC 1322 explains the sacramental theology in depth. CCC 1324-1327 describes the necessity of the Eucharist for Christian life.",
    });
    expect(result.payload.sacramentKey).toBe("eucharist");
    expect(result.payload.sacramentName).toBe("The Eucharist");
    expect(result.payload.catechismReferences).toEqual(
      expect.arrayContaining(["CCC 1322", "CCC 1324-1327"]),
    );
  });

  it("normalizes Confession to reconciliation", () => {
    const result = extractSacrament({
      title: "The Sacrament of Confession",
      body: "Confession is the sacrament of reconciliation with God. The priest hears the penitent's confession and grants absolution.",
    });
    expect(result.payload.sacramentKey).toBe("reconciliation");
  });
});

describe("extractHistory", () => {
  it("extracts the Council of Trent", () => {
    const result = extractHistory({
      title: "Council of Trent",
      body: "The Council of Trent was an ecumenical council of the Catholic Church convened in 1545. It promulgated doctrine on justification, the sacraments, and the canon of scripture. The council closed in 1563.",
    });
    expect(result.complete).toBe(true);
    expect(result.payload.historyType).toBe("Council");
    expect(result.payload.dateOrEra).toMatch(/1545/);
  });

  it("flags a news article as wrong content", () => {
    const result = extractHistory({
      title: "Pope visits city - news article",
      body: "Press release: today the Pope visited the city. Read more at the breaking news section.",
    });
    expect(result.complete).toBe(false);
    expect(result.wrongContentReason).toBe("source_was_news_article");
  });

  it("flags a parish event as wrong content", () => {
    const result = extractHistory({
      title: "Annual parish event",
      body: "Join us for our annual parish fundraiser and gala night this Saturday.",
    });
    expect(result.complete).toBe(false);
    expect(result.wrongContentReason).toBe("source_was_event_page");
  });
});

describe("extractLiturgy", () => {
  it("extracts the Order of Mass as formation content", () => {
    const result = extractLiturgy({
      title: "The Order of Mass",
      body: "The Mass structure is divided into the Liturgy of the Word and the Liturgy of the Eucharist. The Eucharistic prayer forms the heart of the Mass.",
    });
    expect(result.payload.liturgyKind).toBe("Mass structure");
    expect(result.complete).toBe(true);
  });

  it("flags a Mass schedule page as wrong content", () => {
    const result = extractLiturgy({
      title: "Sunday Mass Times",
      body: "Mass schedule: Sunday 8am, 10am, 12pm. Times of Mass posted weekly.",
    });
    expect(result.complete).toBe(false);
    expect(result.wrongContentReason).toBe("source_was_event_page");
  });
});

describe("extractParish", () => {
  it("extracts a parish with a complete address", () => {
    const result = extractParish({
      title: "Saint Mary Catholic Parish",
      body: "Saint Mary parish is located at 123 Main Street, Boston, MA, United States. Part of the Archdiocese of Boston. Website: https://stmary.example.org",
      sourceUrl: "https://stmary.example.org",
    });
    expect(result.complete).toBe(true);
    expect(result.payload.parishName).toBe("Saint Mary Catholic Parish");
    expect(result.payload.address).toMatch(/123\s+Main\s+Street/);
    expect(result.payload.country).toBe("United States");
    expect(result.payload.region).toBe("MA");
    expect(result.payload.diocese).toMatch(/Boston/);
    expect(result.payload.websiteUrl).toContain("https://stmary.example.org");
  });

  it("flags missing location when no address is found", () => {
    const result = extractParish({
      title: "Just a parish",
      body: "Welcome to our parish.",
    });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toContain("location");
  });
});
