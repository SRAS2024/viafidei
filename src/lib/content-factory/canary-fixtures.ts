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
