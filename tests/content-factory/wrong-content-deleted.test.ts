/**
 * Wrong-content and incomplete-package handling.
 *
 * The spec requires:
 *   * Wrong content should be logged and deleted (never persisted).
 *   * Incomplete packages should be rejected (never persisted).
 *
 * These tests pin the factory's decisions for both outcomes against
 * realistic fixtures.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/admin-notifications", () => ({
  reportCriticalFailure: vi.fn(),
}));

import { runContentFactory, syntheticSourceDocument } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.contentPackageBuildLog.create.mockResolvedValue({ id: "log" });
  prismaMock.sourceQualityScore.upsert.mockResolvedValue({
    id: "sq",
    sourceId: "src",
    contentType: "Prayer",
    buildSuccessCount: 0,
    buildFailureCount: 0,
    qaPassCount: 0,
    qaFailCount: 0,
    duplicateCount: 0,
    wrongContentCount: 0,
    deletedCount: 0,
    autoPaused: false,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    autoPausedAt: null,
    validPackageRate: null,
    wrongContentRate: null,
    averageCompleteness: null,
    fetchedCount: 0,
  });
  prismaMock.sourceQualityScore.findUnique.mockResolvedValue({
    id: "sq",
    sourceId: "src",
    contentType: "Prayer",
    buildSuccessCount: 0,
    buildFailureCount: 0,
    qaPassCount: 0,
    qaFailCount: 0,
    duplicateCount: 0,
    wrongContentCount: 0,
    deletedCount: 0,
    autoPaused: false,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    autoPausedAt: null,
    validPackageRate: null,
    wrongContentRate: null,
    averageCompleteness: null,
    fetchedCount: 0,
  });
  prismaMock.sourceQualityScore.update.mockResolvedValue({});
});

describe("wrong content — logged + never persisted", () => {
  it("a livestream page submitted as a Prayer is rejected as wrong_content", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/livestream-prayer",
      sourceHost: "vatican.va",
      sourceTitle: "Live Stream — Daily Mass and Prayer",
      rawBody:
        "Watch the live stream of today's Mass and prayer service. " +
        "Join us as we pray together every morning. " +
        "Please subscribe to our YouTube channel for daily live streams.",
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src",
    });
    expect(["wrong-content", "build-failed"]).toContain(result.decision);
    // No prisma.prayer.create should have been called.
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
    // The build log captures the rejection.
    expect(prismaMock.contentPackageBuildLog.create).toHaveBeenCalled();
  });

  it("a parish-named-after-a-saint page submitted as a Saint is rejected as wrong_content", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://st-thomas-parish.example.org/about",
      sourceHost: "st-thomas-parish.example.org",
      sourceTitle: "St. Thomas Aquinas Catholic Parish — About Us",
      rawBody:
        "Welcome to St. Thomas Aquinas Catholic Parish. We are a vibrant community in the Archdiocese of Boston. " +
        "Visit us for Mass at 8am and 10am every Sunday. Office hours: Mon-Fri 9-5. " +
        "Phone: 555-1234. We also run a Catholic school.",
      sourcePurposes: { canIngestSaints: true },
    });
    const result = await runContentFactory({
      contentType: "Saint",
      document: doc,
      sourceId: "src",
    });
    // The builder may classify as wrong_content OR build_failed —
    // either way the row never persists.
    expect(["wrong-content", "build-failed", "qa-rejected", "qa-deleted"]).toContain(
      result.decision,
    );
    expect(prismaMock.saint.create).not.toHaveBeenCalled();
  });
});

describe("incomplete packages — rejected, never persisted", () => {
  it("a Prayer with no prayer text is rejected (build_failed_missing_required_fields)", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/articles/about-prayer",
      sourceHost: "vatican.va",
      sourceTitle: "About the Importance of Prayer",
      rawBody:
        "Prayer is an essential part of the Christian life. The Catechism teaches that prayer is a vital necessity. " +
        "It is the encounter of God's thirst with ours. We should all pray more and reflect on its importance. " +
        "This article explores what the Church says about prayer in general.",
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src",
    });
    // The builder will classify this as wrong_content (article about
    // prayer) or build_failed_missing_required_fields (no actual
    // prayer text).
    expect(["wrong-content", "build-failed"]).toContain(result.decision);
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });

  it("an incomplete Novena (only 3 days of 9) is rejected", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/novenas/incomplete",
      sourceHost: "vatican.va",
      sourceTitle: "Three Day Novena to Our Lady",
      rawBody:
        "A short novena to Our Lady of Perpetual Help.\n\n" +
        "Day 1: Pray the Hail Mary.\n" +
        "Day 2: Pray the Our Father.\n" +
        "Day 3: Pray the Glory Be.\n" +
        "Amen.",
      sourcePurposes: { canIngestNovenas: true },
    });
    const result = await runContentFactory({
      contentType: "Novena",
      document: doc,
      sourceId: "src",
    });
    expect(["build-failed", "wrong-content"]).toContain(result.decision);
    // The decision is observable in the build log.
    expect(prismaMock.contentPackageBuildLog.create).toHaveBeenCalled();
  });
});
