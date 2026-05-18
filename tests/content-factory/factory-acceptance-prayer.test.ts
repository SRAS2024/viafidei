/**
 * Acceptance pipeline test: a Prayer fixture flows through the
 * factory's pre-persist stages and arrives at strict QA as a
 * publish-eligible decision.
 *
 * The test deliberately stays in memory — no DB writes. It exercises:
 *
 *   1. PrayerBuilder.build()       → built_complete_package
 *   2. normalizePackage()          → canonical values
 *   3. enrichPackage()             → provenance completeness
 *   4. runStrictPipelineSync()     → decision "publish" or "update"
 *
 * This is the spec's content-growth acceptance test pattern for one
 * content type. Additional types follow the same shape.
 */

import { describe, expect, it } from "vitest";
import {
  BUILDER_REGISTRY,
  enrichPackage,
  normalizePackage,
  type SourceDocumentSnapshot,
} from "@/lib/content-factory";
import { runStrictPipelineSync } from "@/lib/content-qa/pipeline";

describe("acceptance: Prayer source fixture → strict QA publish", () => {
  it("a high-quality prayer fixture survives build + normalize + enrich + strict QA", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/prayers/our-father",
      sourceHost: "acceptance.example",
      sourceTier: 1,
      sourceTitle: "Our Father",
      cleanedBody:
        "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
      headings: [{ level: 1, text: "Our Father" }],
      paragraphs: [
        "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
      ],
      metadata: { language: "en" },
      sourcePurposes: { canIngestPrayers: true },
      contentChecksum: "acceptance-our-father",
    };

    const builder = BUILDER_REGISTRY.Prayer;
    const buildResult = builder.build({
      document,
      sourceId: null,
      workerJobId: null,
      ingestionBatchId: null,
      sourcePurposes: document.sourcePurposes,
    });
    expect(buildResult.outcome).toBe("built_complete_package");
    if (buildResult.outcome !== "built_complete_package") return;

    normalizePackage(buildResult.package);
    enrichPackage(buildResult.package, builder.builderVersion);

    expect(buildResult.package.sourceUrl).toBe(document.sourceUrl);
    expect(buildResult.package.sourceHost).toBe(document.sourceHost);
    expect(buildResult.package.contentChecksum).toBeTruthy();
    expect(Object.keys(buildResult.package.provenance).length).toBeGreaterThan(0);

    const validation = runStrictPipelineSync(
      {
        contentType: buildResult.package.contentType,
        slug: buildResult.package.slug,
        title: buildResult.package.title,
        sourceUrl: buildResult.package.sourceUrl,
        sourceHost: buildResult.package.sourceHost,
        payload: buildResult.package.payload,
        approvedSourcePurposes: ["canIngestPrayers"],
      },
      {
        canIngestPrayers: true,
        canIngestSaints: false,
        canIngestApparitions: false,
        canIngestParishes: false,
        canIngestDevotions: false,
        canIngestNovenas: false,
        canIngestSacraments: false,
        canIngestRosaryGuides: false,
        canIngestConsecrations: false,
        canIngestSpiritualGuides: false,
        canIngestLiturgy: false,
        canIngestHistory: false,
        canProvideScriptureText: false,
      },
    );
    expect(["publish", "update"]).toContain(validation.decision);
    expect(validation.publicRenderReady).toBe(true);
    expect(validation.isThresholdEligible).toBe(true);
  });

  it("a junk page (single sentence, no prayer language) fails build with a precise reason", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/news/parish-bbq",
      sourceHost: "acceptance.example",
      sourceTier: 3,
      sourceTitle: "Parish BBQ tomorrow",
      cleanedBody: "Join us this Saturday for the annual parish BBQ. Tickets are $10.",
      headings: [{ level: 1, text: "Parish BBQ tomorrow" }],
      paragraphs: ["Join us this Saturday for the annual parish BBQ. Tickets are $10."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestPrayers: true },
      contentChecksum: "acceptance-bbq",
    };
    const builder = BUILDER_REGISTRY.Prayer;
    const result = builder.build({
      document,
      sourceId: null,
      workerJobId: null,
      ingestionBatchId: null,
      sourcePurposes: document.sourcePurposes,
    });
    expect(result.outcome).not.toBe("built_complete_package");
    if (result.outcome !== "built_complete_package") {
      expect(result.failureReason.length).toBeGreaterThan(0);
    }
  });
});
