/**
 * Validation source health scoring.
 *
 * Proves:
 *   1. A validation source with a high match rate and recent passing
 *      validation scores near 100.
 *   2. A validation source configured but producing no evidence is
 *      penalised (no_evidence).
 *   3. A failing, auto-paused validation source with mostly failed
 *      evidence scores below the healthy floor.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getValidationSourceHealthReport } from "@/lib/data/validation-source-health";

type FnMock = ReturnType<typeof vi.fn>;
let evidence: { groupBy: FnMock };

beforeEach(() => {
  resetPrismaMock();
  evidence = { groupBy: vi.fn().mockResolvedValue([]) };
  (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence = evidence;
});

describe("getValidationSourceHealthReport", () => {
  it("scores a healthy validation source near 100", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        host: "validator.org",
        role: "validation_source",
        consecutiveFailures: 0,
        autoPaused: false,
        lastSuccessfulSync: new Date(),
      },
    ]);
    evidence.groupBy.mockImplementation(async (args: { _max?: unknown }) => {
      if (args._max) return [{ sourceHost: "validator.org", _max: { createdAt: new Date() } }];
      return [
        { sourceHost: "validator.org", validationDecision: "pass", _count: { _all: 18 } },
        { sourceHost: "validator.org", validationDecision: "fail", _count: { _all: 2 } },
      ];
    });

    const report = await getValidationSourceHealthReport();
    const row = report.rows.find((r) => r.host === "validator.org")!;
    expect(row.matchSuccessRate).toBeCloseTo(0.9);
    expect(row.healthScore).toBeGreaterThanOrEqual(90);
    expect(report.unhealthyCount).toBe(0);
  });

  it("penalises a validation source that has produced no evidence", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        host: "silent.org",
        role: "validation_source",
        consecutiveFailures: 0,
        autoPaused: false,
        lastSuccessfulSync: null,
      },
    ]);

    const report = await getValidationSourceHealthReport();
    const row = report.rows[0];
    expect(row.evidenceCreated).toBe(0);
    expect(row.penalties.map((p) => p.id)).toContain("no_evidence");
  });

  it("flags a failing, auto-paused validation source as unhealthy", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        host: "bad.org",
        role: "validation_source",
        consecutiveFailures: 5,
        autoPaused: true,
        lastSuccessfulSync: null,
      },
    ]);
    evidence.groupBy.mockImplementation(async (args: { _max?: unknown }) => {
      if (args._max) return [];
      return [
        { sourceHost: "bad.org", validationDecision: "fail", _count: { _all: 8 } },
        { sourceHost: "bad.org", validationDecision: "insufficient_evidence", _count: { _all: 4 } },
        { sourceHost: "bad.org", validationDecision: "pass", _count: { _all: 1 } },
      ];
    });

    const report = await getValidationSourceHealthReport();
    const row = report.rows[0];
    expect(row.fetchHealth).toBe("failing");
    expect(row.healthScore).toBeLessThan(60);
    expect(report.unhealthyCount).toBe(1);
  });
});
