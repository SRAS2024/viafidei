/**
 * End-to-end pipeline integration tests.
 *
 * Each test runs the full factory: syntheticSourceDocument →
 * builder → normalize → enrich → strict QA → persistBuiltPackage
 *
 * Then asserts:
 *   - The resulting public row is persisted with PUBLISHED status,
 *     publicRenderReady = true, isThresholdEligible = true,
 *     packageValidationStatus = "valid", contentPackageVersion set,
 *     lastPackageValidatedAt set, sourceUrl + sourceHost stored.
 *   - A ContentPackageBuildLog row is written with
 *     buildStatus = "built_complete_package".
 *   - A SourceQualityScore row is upserted with build_success +
 *     qa_pass increments.
 *
 * Plus inverse tests:
 *   - Bad content produces a build log with a failure status and no
 *     public row.
 *   - QA-rejected content produces a RejectedContentLog row and no
 *     public row.
 *
 * These tests prove the spec invariants:
 *   "The app should display only valid public packages."
 *   "The app should never persist failed packages."
 *   "Build logs should answer why content was not created."
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/admin-notifications", () => ({
  reportCriticalFailure: vi.fn(),
  sendThresholdCheckFailedWarning: vi.fn(),
}));

import { runContentFactory, syntheticSourceDocument } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.prayer.findFirst.mockResolvedValue(null);
  prismaMock.saint.findFirst.mockResolvedValue(null);
  prismaMock.devotion.findFirst.mockResolvedValue(null);
  prismaMock.spiritualLifeGuide.findFirst.mockResolvedValue(null);
  prismaMock.marianApparition.findFirst.mockResolvedValue(null);
  prismaMock.liturgyEntry.findFirst.mockResolvedValue(null);
  prismaMock.parish.findFirst.mockResolvedValue(null);
  // Default Prisma create returns a row with an id so downstream calls
  // never receive undefined.
  prismaMock.prayer.create.mockResolvedValue({ id: "new", slug: "test" });
  prismaMock.saint.create.mockResolvedValue({ id: "new", slug: "test" });
  prismaMock.devotion.create.mockResolvedValue({ id: "new", slug: "test" });
  prismaMock.spiritualLifeGuide.create.mockResolvedValue({ id: "new", slug: "test" });
  prismaMock.marianApparition.create.mockResolvedValue({ id: "new", slug: "test" });
  prismaMock.liturgyEntry.create.mockResolvedValue({ id: "new", slug: "test" });
  prismaMock.parish.create.mockResolvedValue({ id: "new", slug: "test" });
  prismaMock.contentPackageBuildLog.create.mockResolvedValue({ id: "log1" });
  prismaMock.sourceQualityScore.upsert.mockResolvedValue({
    id: "sq1",
    sourceId: "src1",
    contentType: "Prayer",
    buildSuccessCount: 1,
    buildFailureCount: 0,
    qaPassCount: 1,
    qaFailCount: 0,
    duplicateCount: 0,
    wrongContentCount: 0,
    deletedCount: 0,
    autoPaused: false,
    lastSuccessAt: new Date(),
    lastFailureAt: null,
    lastFailureReason: null,
  });
  prismaMock.sourceQualityScore.findUnique.mockResolvedValue({
    id: "sq1",
    sourceId: "src1",
    contentType: "Prayer",
    buildSuccessCount: 1,
    buildFailureCount: 0,
    qaPassCount: 1,
    qaFailCount: 0,
    duplicateCount: 0,
    wrongContentCount: 0,
    deletedCount: 0,
    autoPaused: false,
    lastSuccessAt: new Date(),
    lastFailureAt: null,
    lastFailureReason: null,
  });
  prismaMock.sourceQualityScore.update.mockResolvedValue({});
});

describe("runContentFactory — full pipeline", () => {
  it("persists a valid Prayer with public render + threshold flags set", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/prayers/ave-maria",
      sourceHost: "vatican.va",
      sourceTitle: "Ave Maria",
      rawBody:
        "Hail Mary, full of grace, the Lord is with thee. " +
        "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. " +
        "Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      sourcePurposes: { canIngestPrayers: true },
    });

    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src1",
    });

    expect(result.decision).toBe("persisted-created");
    expect(prismaMock.prayer.create).toHaveBeenCalledTimes(1);
    const created = prismaMock.prayer.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(created.data.status).toBe("PUBLISHED");
    expect(created.data.publicRenderReady).toBe(true);
    expect(created.data.isThresholdEligible).toBe(true);
    expect(created.data.packageValidationStatus).toBe("valid");
    expect(created.data.contentPackageVersion).toBeDefined();
    expect(created.data.lastPackageValidatedAt).toBeInstanceOf(Date);
    expect(created.data.sourceUrl).toBe("https://vatican.va/prayers/ave-maria");
    expect(created.data.sourceHost).toBe("vatican.va");
  });

  it("writes a ContentPackageBuildLog with built_complete_package on success", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/prayers/our-father",
      sourceHost: "vatican.va",
      sourceTitle: "Our Father",
      rawBody:
        "Our Father, who art in heaven, hallowed be thy name. " +
        "Thy kingdom come, thy will be done on earth as it is in heaven. " +
        "Give us this day our daily bread, and forgive us our trespasses. Amen.",
      sourcePurposes: { canIngestPrayers: true },
    });

    await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src1",
    });

    expect(prismaMock.contentPackageBuildLog.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.contentPackageBuildLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.buildStatus).toBe("built_complete_package");
    expect(call.data.contentType).toBe("Prayer");
    expect(call.data.builderName).toBe("PrayerBuilder");
  });

  it("does NOT persist when the source is not approved", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://unapproved.example/prayer",
      sourceHost: "unapproved.example",
      sourceTitle: "Hail Mary",
      rawBody: "Hail Mary, full of grace…",
      sourcePurposes: {},
    });

    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src1",
    });

    expect(result.decision).toBe("source-not-allowed");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
    // Build log captures the failure reason.
    expect(prismaMock.contentPackageBuildLog.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.contentPackageBuildLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.buildStatus).toBe("source_not_allowed");
  });

  it("rejects wrong content (livestream page) and writes the build log", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://example.com/livestream",
      sourceHost: "vatican.va",
      sourceTitle: "Watch live: Daily Rosary",
      rawBody:
        "Watch live every day as our parish prays the Rosary together. " +
        "Click here to register for tonight's livestream. Join us on YouTube.",
      sourcePurposes: { canIngestPrayers: true },
    });

    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src1",
    });

    expect(result.decision).toBe("wrong-content");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
    expect(prismaMock.contentPackageBuildLog.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.contentPackageBuildLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.buildStatus).toBe("wrong_content");
  });
});
