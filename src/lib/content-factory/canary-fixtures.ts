/**
 * Canary source fixtures.
 *
 * Each content type has at least one known-good fixture page. The
 * canary runner feeds the fixture through the real factory chain
 * (builder → normalize → enrich → strict QA) and reports whether
 * the build succeeded — without writing anything to the database.
 *
 * If the canary fails on deploy, the content factory is unhealthy
 * (a builder regressed, a contract changed, etc.) and the admin
 * sees the failure on the production readiness page before public
 * users do.
 */

import type { ContentTypeKey, SourceDocumentSnapshot } from "./types";
import { getBuilder } from "./builders";

export type CanaryFixture = {
  contentType: ContentTypeKey;
  fixtureName: string;
  document: SourceDocumentSnapshot;
};

const CANARY_FIXTURES: CanaryFixture[] = [
  {
    contentType: "Prayer",
    fixtureName: "Hail Mary",
    document: {
      sourceUrl: "https://canary.example/prayer/hail-mary",
      sourceHost: "canary.example",
      sourceTier: 1,
      sourceTitle: "Hail Mary",
      cleanedBody:
        "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      headings: [{ level: 1, text: "Hail Mary" }],
      paragraphs: [
        "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      ],
      metadata: { language: "en" },
      sourcePurposes: { canIngestPrayers: true },
      contentChecksum: "canary-hail-mary",
    },
  },
  {
    contentType: "Saint",
    fixtureName: "Saint Therese of Lisieux",
    document: {
      sourceUrl: "https://canary.example/saints/therese-of-lisieux",
      sourceHost: "canary.example",
      sourceTier: 1,
      sourceTitle: "Saint Therese of Lisieux",
      cleanedBody:
        "Feast day: October 1. Saint Therese of Lisieux, also called The Little Flower, was a French Carmelite nun who lived from 1873 to 1897. She is a Doctor of the Church and patron saint of missions.",
      headings: [{ level: 1, text: "Saint Therese of Lisieux" }],
      paragraphs: [
        "Feast day: October 1.",
        "Saint Therese of Lisieux, also called The Little Flower, was a French Carmelite nun who lived from 1873 to 1897.",
        "She is a Doctor of the Church and patron saint of missions.",
      ],
      metadata: { language: "en" },
      sourcePurposes: { canIngestSaints: true },
      contentChecksum: "canary-therese",
    },
  },
  {
    contentType: "Devotion",
    fixtureName: "Sacred Heart Devotion",
    document: {
      sourceUrl: "https://canary.example/devotions/sacred-heart",
      sourceHost: "canary.example",
      sourceTier: 1,
      sourceTitle: "Devotion to the Sacred Heart of Jesus",
      cleanedBody:
        "The Devotion to the Sacred Heart of Jesus is one of the most widely practiced Catholic devotions. " +
        "Practice: pray the Litany of the Sacred Heart each Friday and attend Mass on the First Friday of every month.",
      headings: [{ level: 1, text: "Devotion to the Sacred Heart of Jesus" }],
      paragraphs: [
        "The Devotion to the Sacred Heart of Jesus is one of the most widely practiced Catholic devotions.",
        "Practice: pray the Litany of the Sacred Heart each Friday and attend Mass on the First Friday of every month.",
      ],
      metadata: { language: "en" },
      sourcePurposes: { canIngestDevotions: true },
      contentChecksum: "canary-sacred-heart",
    },
  },
  {
    contentType: "Parish",
    fixtureName: "Cathedral of the Holy Cross",
    document: {
      sourceUrl: "https://canary.example/parishes/holy-cross-boston",
      sourceHost: "canary.example",
      sourceTier: 1,
      sourceTitle: "Cathedral of the Holy Cross",
      cleanedBody:
        "Cathedral of the Holy Cross, 1400 Washington Street, Boston, Massachusetts, United States. " +
        "Diocese: Archdiocese of Boston. The Cathedral is the principal church of the Archdiocese of Boston.",
      headings: [{ level: 1, text: "Cathedral of the Holy Cross" }],
      paragraphs: [
        "Address: 1400 Washington Street, Boston, Massachusetts, United States.",
        "Diocese: Archdiocese of Boston.",
      ],
      metadata: {
        language: "en",
        city: "Boston",
        country: "United States",
        region: "Massachusetts",
      },
      sourcePurposes: { canIngestParishes: true },
      contentChecksum: "canary-holy-cross",
    },
  },
  {
    contentType: "Liturgy",
    fixtureName: "Liturgical Year overview",
    document: {
      sourceUrl: "https://canary.example/liturgy/liturgical-year",
      sourceHost: "canary.example",
      sourceTier: 1,
      sourceTitle: "The Liturgical Year",
      cleanedBody:
        "The Liturgical Year structures the celebrations of the Catholic Church through Advent, Christmas, " +
        "Lent, Easter, and Ordinary Time. Each season has its own liturgical color and theological focus.",
      headings: [{ level: 1, text: "The Liturgical Year" }],
      paragraphs: [
        "The Liturgical Year structures the celebrations of the Catholic Church through Advent, Christmas, Lent, Easter, and Ordinary Time.",
        "Each season has its own liturgical color and theological focus.",
      ],
      metadata: { language: "en" },
      sourcePurposes: { canIngestLiturgy: true },
      contentChecksum: "canary-liturgical-year",
    },
  },
  {
    contentType: "History",
    fixtureName: "First Council of Nicaea",
    document: {
      sourceUrl: "https://canary.example/history/first-council-of-nicaea",
      sourceHost: "canary.example",
      sourceTier: 1,
      sourceTitle: "First Council of Nicaea",
      cleanedBody:
        "The First Council of Nicaea was a council of Christian bishops convened in the Bithynian city of Nicaea " +
        "by Emperor Constantine I in AD 325. It produced the original Nicene Creed and is considered the first " +
        "ecumenical council of the Church.",
      headings: [{ level: 1, text: "First Council of Nicaea" }],
      paragraphs: [
        "Date: AD 325. The First Council of Nicaea was a council of Christian bishops convened by Emperor Constantine I.",
        "It produced the original Nicene Creed and is considered the first ecumenical council of the Church.",
      ],
      metadata: { language: "en", historyType: "Councils" },
      sourcePurposes: { canIngestHistory: true },
      contentChecksum: "canary-nicaea",
    },
  },
  {
    contentType: "Sacrament",
    fixtureName: "Baptism",
    document: {
      sourceUrl: "https://canary.example/sacrament/baptism",
      sourceHost: "canary.example",
      sourceTier: 1,
      sourceTitle: "The Sacrament of Baptism",
      cleanedBody:
        "Baptism is the first of the seven sacraments and the gateway to the Christian life. " +
        "Through Baptism we are freed from sin and reborn as children of God. " +
        "The Sacrament of Baptism is one of the three sacraments of Initiation.",
      headings: [{ level: 1, text: "The Sacrament of Baptism" }],
      paragraphs: [
        "Baptism is the first of the seven sacraments and the gateway to the Christian life.",
        "The Sacrament of Baptism is one of the three sacraments of Initiation.",
      ],
      metadata: { language: "en" },
      sourcePurposes: { canIngestSacraments: true },
      contentChecksum: "canary-baptism",
    },
  },
];

export type CanaryResult = {
  contentType: ContentTypeKey;
  fixtureName: string;
  passed: boolean;
  outcome: string;
  failureReason?: string;
  missingFields?: string[];
};

export type CanaryReport = {
  generatedAt: Date;
  results: CanaryResult[];
  /** All canaries pass → the content factory is healthy. */
  factoryHealthy: boolean;
};

/**
 * Run every canary fixture through its builder and return the
 * per-fixture result. The runner does NOT mutate state — it only
 * executes the builder's pure build() function.
 */
export function runCanaryBuilds(): CanaryReport {
  const results: CanaryResult[] = [];
  for (const fixture of CANARY_FIXTURES) {
    const builder = getBuilder(fixture.contentType);
    const result = builder.build({
      document: fixture.document,
      sourceId: null,
      workerJobId: null,
      ingestionBatchId: null,
      sourcePurposes: fixture.document.sourcePurposes,
    });
    if (result.outcome === "built_complete_package") {
      results.push({
        contentType: fixture.contentType,
        fixtureName: fixture.fixtureName,
        passed: true,
        outcome: result.outcome,
      });
    } else {
      results.push({
        contentType: fixture.contentType,
        fixtureName: fixture.fixtureName,
        passed: false,
        outcome: result.outcome,
        failureReason: result.failureReason,
        missingFields: [...(result.missingFields ?? [])],
      });
    }
  }
  return {
    generatedAt: new Date(),
    results,
    factoryHealthy: results.every((r) => r.passed),
  };
}

export function getCanaryFixtures(): ReadonlyArray<CanaryFixture> {
  return CANARY_FIXTURES;
}
