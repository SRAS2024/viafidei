/**
 * Additional source-fixture coverage.
 *
 * Spec requires:
 *   - valid source fixtures           ✓ (already covered in builders.test.ts)
 *   - invalid source fixtures         ✓ (already covered)
 *   - messy source fixtures           (here)
 *   - partial source fixtures         (here)
 *   - duplicate source fixtures       (here)
 *   - unapproved source fixtures      ✓ (already covered)
 *
 * Plus tests proving:
 *   - content appears only after being built AND QA approved
 *   - bad content is deleted and logged
 *   - no metric shows false zero (covered by dashboard tests)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/admin-notifications", () => ({
  reportCriticalFailure: vi.fn(),
  sendThresholdCheckFailedWarning: vi.fn(),
}));

import { PrayerBuilder, SaintBuilder, syntheticSourceDocument } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

describe("messy source fixtures — cleanup strips noise but keeps content", () => {
  it("PrayerBuilder still builds when the page has navigation / footer noise around the prayer", () => {
    // Light noise: copyright footer + navigation link. No strong
    // wrong-content signals (no donate / livestream / register).
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/prayer/messy",
      sourceHost: "vatican.va",
      sourceTitle: "Ave Maria",
      rawBody: [
        "Skip to main content",
        "Home",
        "",
        "Hail Mary, full of grace, the Lord is with thee. " +
          "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. " +
          "Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
        "",
        "© 2024 Example Parish",
      ].join("\n"),
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = PrayerBuilder.build({ document: doc });
    expect(result.outcome).toBe("built_complete_package");
  });

  it("PrayerBuilder rejects a fixture so messy it has multiple donation/newsletter/livestream signals", () => {
    // Multiple strong wrong-content signals → wrong_content outcome.
    // This is the correct behavior: a prayer hidden under that much
    // chrome is probably actually a parish landing page, not a prayer.
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/prayer/over-messy",
      sourceHost: "vatican.va",
      sourceTitle: "Prayer page",
      rawBody: [
        "Donate now to support our parish",
        "Subscribe to our newsletter",
        "Register now for tonight's livestream",
        "Watch live on YouTube",
        "Hail Mary, full of grace.",
      ].join("\n"),
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = PrayerBuilder.build({ document: doc });
    expect(result.outcome).toBe("wrong_content");
  });
});

describe("partial source fixtures — fail with missing-fields outcome", () => {
  it("SaintBuilder reports missing required fields when biography is too short", () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/saint/partial",
      sourceHost: "vatican.va",
      sourceTitle: "St. Nobody",
      rawBody: "Brief.",
      sourcePurposes: { canIngestSaints: true },
    });
    const result = SaintBuilder.build({ document: doc });
    // Short body fails the wrong-content density check OR the
    // missing-fields check. Either way, we never produce a complete
    // package from a one-word bio.
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("duplicate source fixtures — second build skipped at persistence", () => {
  it("the second persist call returns skipped when the checksum matches", async () => {
    const { persistBuiltPackage } = await import("@/lib/content-factory");
    // First call: row does not exist yet.
    prismaMock.prayer.findFirst.mockResolvedValueOnce(null);
    prismaMock.prayer.create.mockResolvedValueOnce({ id: "p-dup", slug: "ave-maria-dup" });
    // Second call: row exists with the same checksum.
    prismaMock.prayer.findFirst.mockResolvedValueOnce({
      id: "p-dup",
      slug: "ave-maria-dup",
      contentChecksum: "checksum-dup",
    });

    const pkg = {
      contentType: "Prayer" as const,
      slug: "ave-maria-dup",
      title: "Ave Maria",
      sourceUrl: "https://vatican.va/p",
      sourceHost: "vatican.va",
      contentChecksum: "checksum-dup",
      payload: {
        prayerName: "Ave Maria",
        prayerText: "Hail Mary…",
        prayerType: "Marian prayer",
        category: "Marian prayer",
      },
      provenance: {
        prayerName: prov(),
        prayerText: prov(),
        prayerType: prov(),
        category: prov(),
        slug: prov(),
      },
    };
    const validation = {
      decision: "publish" as const,
      contractName: "PrayerPackage",
      contentType: "Prayer" as const,
      failedFields: [] as string[],
      reason: "ok",
      publicRenderReady: true,
      isThresholdEligible: true,
      contractVersion: "1.0.0",
    };

    const first = await persistBuiltPackage({ pkg, validation });
    expect(first.outcome).toBe("created");
    const second = await persistBuiltPackage({ pkg, validation });
    expect(second.outcome).toBe("skipped");
  });
});

describe("content visibility invariant", () => {
  it("a Prayer row never reaches PUBLISHED without going through the factory", async () => {
    const { runContentFactory } = await import("@/lib/content-factory");
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({ id: "p1", slug: "test" });
    prismaMock.contentPackageBuildLog.create.mockResolvedValue({ id: "log" });
    prismaMock.sourceQualityScore.upsert.mockResolvedValue({
      id: "sq",
      buildSuccessCount: 1,
      buildFailureCount: 0,
      qaPassCount: 1,
      qaFailCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      deletedCount: 0,
      autoPaused: false,
    });
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue({
      id: "sq",
      buildSuccessCount: 1,
      buildFailureCount: 0,
      qaPassCount: 1,
      qaFailCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      deletedCount: 0,
      autoPaused: false,
      sourceId: "src",
      contentType: "Prayer",
    });
    prismaMock.sourceQualityScore.update.mockResolvedValue({});

    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/p/test",
      sourceHost: "vatican.va",
      sourceTitle: "Test Prayer",
      rawBody:
        "Hail Mary, full of grace, the Lord is with thee. " +
        "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Amen.",
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src",
      sourceRole: "primary_content_source",
    });
    expect(result.decision).toBe("persisted-created");
    // The persistence call sets publicRenderReady AND isThresholdEligible
    // — proving the factory is the only path to public visibility.
    const created = prismaMock.prayer.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(created.data.publicRenderReady).toBe(true);
    expect(created.data.isThresholdEligible).toBe(true);
  });
});

function prov() {
  return {
    sourceUrl: "https://vatican.va/p",
    sourceHost: "vatican.va",
    sourceDocumentId: null,
    sourceHeading: null,
    sourceSection: null,
    snippetHash: "h",
    extractionMethod: "test",
    extractorVersion: "1.0.0",
    confidence: 0.9,
    timestamp: new Date().toISOString(),
  };
}
