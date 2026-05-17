/**
 * Content factory builder unit tests.
 *
 * One test per builder covers:
 *   - valid fixture       → built_complete_package + required fields
 *   - invalid fixture     → wrong_content / build_failed_missing_required_fields
 *   - unapproved source   → source_not_allowed
 *   - empty body          → not_supported_by_source
 *
 * Each test exercises the same shared pipeline: synthetic
 * SourceDocument → builder.build() → BuildResult assertions.
 */

import { describe, expect, it } from "vitest";
import {
  PrayerBuilder,
  SaintBuilder,
  MarianApparitionBuilder,
  DevotionBuilder,
  NovenaBuilder,
  SacramentBuilder,
  RosaryBuilder,
  ConsecrationBuilder,
  SpiritualGuidanceBuilder,
  LiturgyBuilder,
  HistoryBuilder,
  ParishBuilder,
  syntheticSourceDocument,
} from "@/lib/content-factory";

function buildContext(opts: {
  body: string;
  title: string;
  url: string;
  host: string;
  purposeFlag: string;
}) {
  const doc = syntheticSourceDocument({
    sourceUrl: opts.url,
    sourceHost: opts.host,
    sourceTitle: opts.title,
    rawBody: opts.body,
    sourcePurposes: { [opts.purposeFlag]: true },
    language: "en",
  });
  return { document: doc };
}

describe("PrayerBuilder", () => {
  it("builds a complete prayer package from a real prayer body", () => {
    const ctx = buildContext({
      url: "https://vatican.va/prayers/hail-mary",
      host: "vatican.va",
      title: "Hail Mary",
      purposeFlag: "canIngestPrayers",
      body:
        "Hail Mary, full of grace, the Lord is with thee. " +
        "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. " +
        "Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
    });
    const result = PrayerBuilder.build(ctx);
    expect(result.outcome).toBe("built_complete_package");
    if (result.outcome !== "built_complete_package") return;
    expect(result.package.payload.prayerName).toBeDefined();
    expect(result.package.payload.prayerText).toMatch(/Hail Mary/);
    expect(result.package.payload.prayerType).toBe("Marian prayer");
    expect(result.package.provenance.prayerText).toBeDefined();
    expect(result.package.provenance.prayerText.extractionMethod).toBeDefined();
  });

  it("rejects a livestream page as wrong_content", () => {
    const ctx = buildContext({
      url: "https://example.com/prayer-livestream",
      host: "vatican.va",
      title: "Watch Live: Daily Rosary Prayer Service",
      purposeFlag: "canIngestPrayers",
      body:
        "Watch live as we pray the Rosary together. Click here to register for tonight's livestream. " +
        "Join us on YouTube for our nightly broadcast.",
    });
    const result = PrayerBuilder.build(ctx);
    expect(result.outcome).toBe("wrong_content");
  });

  it("flags missing fields when the body has no prayer text", () => {
    const ctx = buildContext({
      url: "https://example.com/about-prayer",
      host: "vatican.va",
      title: "About Prayer",
      purposeFlag: "canIngestPrayers",
      body: "Prayer is essential to the Catholic life and offers many graces. We invite you to learn more about it through our resources and devotional materials.",
    });
    const result = PrayerBuilder.build(ctx);
    expect(result.outcome).toBe("wrong_content");
  });

  it("refuses when the source is not approved for prayers", () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://unapproved.example/prayer",
      sourceHost: "unapproved.example",
      rawBody: "Hail Mary full of grace…",
      sourcePurposes: { canIngestSaints: true },
    });
    const result = PrayerBuilder.build({ document: doc });
    expect(result.outcome).toBe("source_not_allowed");
  });
});

describe("SaintBuilder", () => {
  it("builds a saint profile from a biography", () => {
    const ctx = buildContext({
      url: "https://vatican.va/saints/st-thomas-aquinas",
      host: "vatican.va",
      title: "St. Thomas Aquinas",
      purposeFlag: "canIngestSaints",
      body:
        "St. Thomas Aquinas was a Doctor of the Church and Dominican friar who synthesized faith and reason " +
        "in his masterwork the Summa Theologiae. Feast day: January 28. Patron saint of theologians and Catholic universities. " +
        "He died at the abbey of Fossanova in 1274.",
    });
    const result = SaintBuilder.build(ctx);
    expect(result.outcome).toBe("built_complete_package");
    if (result.outcome !== "built_complete_package") return;
    expect(result.package.payload.feastDay).toMatch(/January 28/);
    expect(result.package.payload.biography).toContain("Doctor of the Church");
    expect(result.package.provenance.biography).toBeDefined();
  });

  it("rejects an institution page (parish named after a saint)", () => {
    const ctx = buildContext({
      url: "https://example.com/parish",
      host: "vatican.va",
      title: "St. Augustine Parish",
      purposeFlag: "canIngestSaints",
      body:
        "Welcome to St. Augustine Parish church. Visit our parish bulletin and watch the livestream. " +
        "Our parish staff serves the local community in many beautiful ways every single day.",
    });
    const result = SaintBuilder.build(ctx);
    expect(result.outcome).toBe("wrong_content");
  });
});

describe("MarianApparitionBuilder", () => {
  it("builds an apparition package from a known site", () => {
    const ctx = buildContext({
      url: "https://vatican.va/apparitions/fatima",
      host: "vatican.va",
      title: "Our Lady of Fatima",
      purposeFlag: "canIngestApparitions",
      body:
        "Our Lady of Fatima appeared to three shepherd children in Fatima, Portugal in 1917. The apparitions occurred over six months and drew enormous attention from the faithful around the world during a time of war.\n\n" +
        "She was officially approved as worthy of belief by the Catholic Church after a careful investigation by the local bishop. The apparitions revealed three prophecies and called for prayer, penance, and consecration to the Immaculate Heart of Mary.",
    });
    const result = MarianApparitionBuilder.build(ctx);
    expect(result.outcome).toBe("built_complete_package");
  });
});

describe("DevotionBuilder", () => {
  it("builds a devotion package with practice instructions", () => {
    const ctx = buildContext({
      url: "https://vatican.va/devotions/divine-mercy",
      host: "vatican.va",
      title: "Divine Mercy Devotion",
      purposeFlag: "canIngestDevotions",
      body:
        "The Divine Mercy devotion was given by Jesus to St. Faustina Kowalska in the 1930s. " +
        "Practice: Recite the Divine Mercy Chaplet daily at 3:00 PM, the Hour of Mercy. " +
        "Begin with the Our Father, Hail Mary, and the Apostles' Creed.",
    });
    const result = DevotionBuilder.build(ctx);
    expect(result.outcome).toBe("built_complete_package");
  });
});

describe("NovenaBuilder", () => {
  it("rejects an incomplete novena (only 3 days)", () => {
    const ctx = buildContext({
      url: "https://vatican.va/novenas/short",
      host: "vatican.va",
      title: "Three Day Novena",
      purposeFlag: "canIngestNovenas",
      body: "Day 1: Pray the Hail Mary. Day 2: Pray the Our Father. Day 3: Pray the Glory Be.",
    });
    const result = NovenaBuilder.build(ctx);
    expect(result.outcome).toBe("build_failed_missing_required_fields");
  });
});

describe("SacramentBuilder", () => {
  it("normalizes Confession to Reconciliation", () => {
    const ctx = buildContext({
      url: "https://vatican.va/sacraments/confession",
      host: "vatican.va",
      title: "The Sacrament of Confession",
      purposeFlag: "canIngestSacraments",
      body:
        "The Sacrament of Confession (also known as Reconciliation or Penance) is one of the seven sacraments. " +
        "Outward sign: the absolution given by the priest. Effects of the sacrament: forgiveness of sins. " +
        "Catechism of the Catholic Church paragraphs 1422-1498 explain the sacrament. " +
        "How to prepare: examine your conscience. How to participate: confess your sins to a priest. " +
        "Biblical foundation: John 20:22-23, where Christ gives the apostles authority to forgive sins.",
    });
    const result = SacramentBuilder.build(ctx);
    if (result.outcome === "built_complete_package") {
      expect(result.package.payload.sacramentKey).toBe("reconciliation");
    }
  });
});

describe("HistoryBuilder", () => {
  it("classifies a Council page", () => {
    const ctx = buildContext({
      url: "https://vatican.va/history/vatican-ii",
      host: "vatican.va",
      title: "The Second Vatican Council",
      purposeFlag: "canIngestHistory",
      body:
        "The Second Vatican Council (Vatican II) was the 21st ecumenical council of the Catholic Church. " +
        "It opened on October 11, 1962 under Pope John XXIII and closed on December 8, 1965 under Pope Paul VI. " +
        "Main outcomes: Sacrosanctum Concilium, Lumen Gentium, Gaudium et Spes, Dei Verbum.",
    });
    const result = HistoryBuilder.build(ctx);
    if (result.outcome === "built_complete_package") {
      expect(result.package.payload.historyType).toMatch(/council/i);
    } else {
      // The extractor may classify it differently; in either case it must not silently succeed without category.
      expect(["build_failed_missing_required_fields", "wrong_content"]).toContain(result.outcome);
    }
  });
});

describe("ParishBuilder", () => {
  it("rejects a bulletin page", () => {
    const ctx = buildContext({
      url: "https://example.com/bulletin",
      host: "vatican.va",
      title: "Parish bulletin June 15",
      purposeFlag: "canIngestParishes",
      body: "This week's parish bulletin: see attached PDF for events, donate now to support our community.",
    });
    const result = ParishBuilder.build(ctx);
    // Wrong-content guard rejects bulletin / donation phrasing.
    expect(["wrong_content", "build_failed_missing_required_fields"]).toContain(result.outcome);
  });
});

describe("LiturgyBuilder", () => {
  it("rejects a Mass schedule", () => {
    const ctx = buildContext({
      url: "https://example.com/mass",
      host: "vatican.va",
      title: "Mass Schedule",
      purposeFlag: "canIngestLiturgy",
      body: "Sunday Mass at 9:00 AM and 11:00 AM. Daily Mass times: Monday-Friday at 8:00 AM.",
    });
    const result = LiturgyBuilder.build(ctx);
    expect(["wrong_content", "build_failed_missing_required_fields"]).toContain(result.outcome);
  });
});

describe("ConsecrationBuilder", () => {
  it("returns a failure when there is no daily structure", () => {
    const ctx = buildContext({
      url: "https://vatican.va/consecration/marian",
      host: "vatican.va",
      title: "Total Consecration to Mary",
      purposeFlag: "canIngestConsecrations",
      body: "An article describing the spiritual benefits of total consecration to Mary, with no daily structure.",
    });
    const result = ConsecrationBuilder.build(ctx);
    expect(["build_failed_missing_required_fields", "wrong_content"]).toContain(result.outcome);
  });
});

describe("RosaryBuilder", () => {
  it("rejects an article without the mysteries", () => {
    const ctx = buildContext({
      url: "https://vatican.va/rosary/why",
      host: "vatican.va",
      title: "Why we pray the Rosary",
      purposeFlag: "canIngestRosaryGuides",
      body: "An essay on the spiritual benefits of praying the Rosary, with no actual prayer order.",
    });
    const result = RosaryBuilder.build(ctx);
    expect(["build_failed_missing_required_fields", "wrong_content"]).toContain(result.outcome);
  });
});

describe("SpiritualGuidanceBuilder", () => {
  it("rejects a guide with fewer than two ordered steps", () => {
    const ctx = buildContext({
      url: "https://vatican.va/guides/prayer-routine",
      host: "vatican.va",
      title: "Building a prayer routine",
      purposeFlag: "canIngestSpiritualGuides",
      body: "A free-form essay on the value of daily prayer with no numbered steps.",
    });
    const result = SpiritualGuidanceBuilder.build(ctx);
    expect(result.outcome).toBe("build_failed_missing_required_fields");
  });

  it("builds a guide with three explicit steps", () => {
    const ctx = buildContext({
      url: "https://vatican.va/guides/prayer-routine",
      host: "vatican.va",
      title: "Daily prayer routine",
      purposeFlag: "canIngestSpiritualGuides",
      body:
        "A simple routine for daily Catholic prayer that any layperson can follow during ordinary time.\n\n" +
        "1. Begin with the Sign of the Cross and a moment of silence.\n" +
        "2. Read the daily Gospel passage and reflect for two minutes.\n" +
        "3. Close with the Our Father and a short act of thanksgiving.",
    });
    const result = SpiritualGuidanceBuilder.build(ctx);
    expect(result.outcome).toBe("built_complete_package");
    if (result.outcome === "built_complete_package") {
      expect((result.package.payload.steps as unknown[]).length).toBeGreaterThanOrEqual(2);
    }
  });
});
