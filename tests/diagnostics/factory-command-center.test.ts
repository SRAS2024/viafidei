/**
 * Factory command center tests.
 *
 * The report aggregates the spec-listed factory metrics into one
 * payload. We mock Prisma so the test pins:
 *   - every spec section appears
 *   - counters populate from the mock counts
 *   - missing dependencies degrade to zero/empty without throwing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getFactoryCommandCenter } from "@/lib/diagnostics/factory-command-center";

beforeEach(() => {
  resetPrismaMock();
});

describe("getFactoryCommandCenter()", () => {
  it("produces every spec-listed section", async () => {
    for (const m of [
      prismaMock.ingestionSource,
      prismaMock.ingestionJobQueue,
      prismaMock.sourceDocument,
      prismaMock.contentPackageBuildLog,
      prismaMock.rejectedContentLog,
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockResolvedValue(0);
    }
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 0, qaFailCount: 0 },
    });
    prismaMock.sourceQualityScore.findFirst.mockResolvedValue(null);
    const report = await getFactoryCommandCenter();
    const keys = new Set(report.sections.map((s) => s.key));
    for (const want of [
      "source_readiness",
      "source_discovery",
      "source_fetch",
      "source_documents",
      "build_attempts",
      "validation_evidence",
      "qa",
      "persistence",
      "public_display",
      "cache_revalidation",
      "deleted_invalid",
      "source_quality",
      "production_readiness",
    ]) {
      expect(keys.has(want)).toBe(true);
    }
  });

  it("surfaces non-zero counts from the underlying tables", async () => {
    let callIndex = 0;
    for (const m of [
      prismaMock.ingestionSource,
      prismaMock.ingestionJobQueue,
      prismaMock.sourceDocument,
      prismaMock.contentPackageBuildLog,
      prismaMock.rejectedContentLog,
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockImplementation(async () => 7 + callIndex++);
    }
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 42, qaFailCount: 5 },
    });
    prismaMock.sourceQualityScore.findFirst.mockResolvedValue({
      sourceId: "src1",
      contentType: "Prayer",
      validPackageRate: 0.95,
    });
    const report = await getFactoryCommandCenter();
    const qaSection = report.sections.find((s) => s.key === "qa");
    expect(qaSection?.value).toBe("42 / 5");
    const persistence = report.sections.find((s) => s.key === "persistence");
    expect(typeof persistence?.value).toBe("number");
  });
});
