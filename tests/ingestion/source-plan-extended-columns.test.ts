/**
 * Source-plan extended columns (spec §15).
 *
 * Spec §15 names the dashboard columns:
 *   - content type
 *   - required source count
 *   - configured source count
 *   - factory ready source count
 *   - validation source count
 *   - enrichment source count
 *   - source health
 *   - source configuration errors
 *   - next automatic repair action
 *
 * This pins that buildSourcePlanReport() returns the spec-listed
 * fields per row and that the values move in lockstep with the
 * mocked source data.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { buildSourcePlanReport } from "@/lib/ingestion/sources/source-plan";

beforeEach(() => {
  resetPrismaMock();
});

describe("Source plan extended columns (spec §15)", () => {
  it("each row carries sourceHealth + nextAutomaticRepairAction", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const report = await buildSourcePlanReport();
    for (const row of report.rows) {
      expect(["healthy", "degraded", "failed"]).toContain(row.sourceHealth);
      expect(typeof row.nextAutomaticRepairAction).toBe("string");
      expect(row.nextAutomaticRepairAction.length).toBeGreaterThan(5);
    }
  });

  it("sourceHealth=failed when factoryReady is zero", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const report = await buildSourcePlanReport();
    expect(report.rows.every((r) => r.sourceHealth === "failed")).toBe(true);
  });

  it("nextAutomaticRepairAction mentions discovery enqueue when failed", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const report = await buildSourcePlanReport();
    expect(
      report.rows.every((r) =>
        /Enqueue source_discovery|mark source configuration as failed/.test(
          r.nextAutomaticRepairAction,
        ),
      ),
    ).toBe(true);
  });

  it("sourceHealth=healthy when every spec minimum is met", async () => {
    const allFlags = [
      "canIngestPrayers",
      "canIngestSaints",
      "canIngestApparitions",
      "canIngestParishes",
      "canIngestDevotions",
      "canIngestNovenas",
      "canIngestSacraments",
      "canIngestRosaryGuides",
      "canIngestConsecrations",
      "canIngestSpiritualGuides",
      "canIngestLiturgy",
      "canIngestHistory",
    ];
    const sources = Array.from({ length: 6 }, (_, i) => {
      const row: Record<string, unknown> = {
        id: `s${i}`,
        isActive: true,
        pausedAt: null,
        role: "primary_content_source",
        discoveryMethod: "sitemap",
        configurationStatus: "factory_native",
      };
      for (const flag of allFlags) row[flag] = true;
      return row;
    });
    prismaMock.ingestionSource.findMany.mockResolvedValue(sources);
    const report = await buildSourcePlanReport();
    expect(report.rows.every((r) => r.sourceHealth === "healthy")).toBe(true);
    expect(report.rows.every((r) => r.nextAutomaticRepairAction === "No action required")).toBe(
      true,
    );
  });
});
