/**
 * Growth stall taxonomy tests (spec §16).
 *
 * Pins:
 *   - every spec-listed stall reason appears in STALL_TAXONOMY
 *   - every entry carries a non-empty automaticNextAction
 *   - detectStalls() composes the list without throwing when Prisma
 *     returns zeros
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { STALL_TAXONOMY, detectStalls } from "@/lib/diagnostics/growth-stall-taxonomy";

beforeEach(() => {
  resetPrismaMock();
});

describe("STALL_TAXONOMY", () => {
  it("includes every spec-listed stall reason", () => {
    const ids = new Set(STALL_TAXONOMY.map((e) => e.id));
    for (const want of [
      "no_configured_sources",
      "no_discovery",
      "no_fetch",
      "fetch_without_build",
      "build_without_qa_pass",
      "qa_pass_without_persistence",
      "persistence_without_public_display",
      "public_display_without_search",
      "public_display_without_sitemap",
      "public_content_without_threshold_movement",
      "high_duplicate_saturation",
      "high_wrong_content_rate",
      "validation_evidence_missing",
    ]) {
      expect(ids.has(want as never), `${want} missing from STALL_TAXONOMY`).toBe(true);
    }
  });

  it("every entry has an automaticNextAction string", () => {
    for (const entry of STALL_TAXONOMY) {
      expect(entry.automaticNextAction.length).toBeGreaterThan(10);
    }
  });
});

describe("detectStalls()", () => {
  it("reports no_configured_sources when every source is unconfigured", async () => {
    for (const m of [
      prismaMock.ingestionSource,
      prismaMock.ingestionJobQueue,
      prismaMock.sourceDocument,
      prismaMock.contentPackageBuildLog,
      prismaMock.rejectedContentLog,
      prismaMock.prayer,
    ]) {
      m.count.mockResolvedValue(0);
    }
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 0 },
    });
    const result = await detectStalls();
    const ids = result.detected.map((d) => d.id);
    expect(ids).toContain("no_configured_sources");
    expect(ids).toContain("no_discovery");
    expect(ids).toContain("no_fetch");
  });

  it("reports validation_evidence_missing when rejection failureCategory is high", async () => {
    for (const m of [
      prismaMock.ingestionSource,
      prismaMock.ingestionJobQueue,
      prismaMock.sourceDocument,
      prismaMock.contentPackageBuildLog,
      prismaMock.prayer,
    ]) {
      m.count.mockResolvedValue(20); // pretend healthy
    }
    prismaMock.rejectedContentLog.count.mockImplementation(async (args?: unknown) => {
      const a = args as { where?: { failureCategory?: string } } | undefined;
      if (a?.where?.failureCategory === "validation_evidence_missing") return 25;
      if (a?.where?.failureCategory === "wrong_content") return 0;
      return 5; // generic
    });
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 100 },
    });
    const result = await detectStalls();
    expect(result.detected.map((d) => d.id)).toContain("validation_evidence_missing");
  });
});
