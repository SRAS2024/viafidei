/**
 * Baseline content audit.
 *
 * Proves:
 *   1. One audit row per baseline fixture.
 *   2. An empty database leaves every baseline fixture "pending"
 *      and the report unhealthy.
 *   3. A fully built + public baseline fixture is "complete" and a
 *      fully built report is healthy.
 *   4. Build failures surface as status "failed" with the reason.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getBaselineAuditReport } from "@/lib/diagnostics/baseline-audit";
import { BASELINE_SEED_FIXTURES } from "@/lib/content-factory/baseline-seed";

const PUBLIC_MODELS = [
  "prayer",
  "saint",
  "devotion",
  "spiritualLifeGuide",
  "liturgyEntry",
] as const;

beforeEach(() => {
  resetPrismaMock();
});

describe("getBaselineAuditReport", () => {
  it("leaves every baseline fixture pending on an empty database", async () => {
    prismaMock.sourceDocument.findUnique.mockResolvedValue(null);
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    for (const model of PUBLIC_MODELS) {
      prismaMock[model].findFirst.mockResolvedValue(null);
    }

    const report = await getBaselineAuditReport();
    expect(report.rows.length).toBe(BASELINE_SEED_FIXTURES.length);
    expect(report.rows.every((r) => r.status === "pending")).toBe(true);
    expect(report.totalPublicPackages).toBe(0);
    expect(report.healthy).toBe(false);
  });

  it("marks a fully built + public baseline fixture complete", async () => {
    prismaMock.sourceDocument.findUnique.mockResolvedValue({ id: "doc-1" });
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      { buildStatus: "built_complete_package", failureReason: null },
    ]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    for (const model of PUBLIC_MODELS) {
      prismaMock[model].findFirst.mockResolvedValue({ id: "row-1" });
    }

    const report = await getBaselineAuditReport();
    expect(report.rows.every((r) => r.status === "complete")).toBe(true);
    expect(report.totalSourceDocuments).toBe(BASELINE_SEED_FIXTURES.length);
    expect(report.totalCompleteBuilds).toBe(BASELINE_SEED_FIXTURES.length);
    expect(report.healthy).toBe(true);
  });

  it("surfaces build failures with their reasons", async () => {
    prismaMock.sourceDocument.findUnique.mockResolvedValue({ id: "doc-1" });
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      {
        buildStatus: "build_failed_missing_required_fields",
        failureReason: "Missing required field: feastDay",
      },
    ]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    for (const model of PUBLIC_MODELS) {
      prismaMock[model].findFirst.mockResolvedValue(null);
    }

    const report = await getBaselineAuditReport();
    expect(report.rows.every((r) => r.status === "failed")).toBe(true);
    expect(report.totalFailures).toBeGreaterThan(0);
    expect(report.rows[0].failureReasons).toContain("Missing required field: feastDay");
  });
});
