/**
 * Production growth runbook.
 *
 * Proves the runbook aggregates the existing factory signals:
 *   1. Stalled content types carry their stall reason + the
 *      automatic next action.
 *   2. Persisted-but-not-public content types surface as failing
 *      public display checks.
 *   3. Paused sources and weak builders are listed.
 *   4. Content types short of validation evidence are listed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/content-growth-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/content-growth-dashboard")>();
  return { ...actual, getContentGrowthDashboard: vi.fn() };
});
vi.mock("@/lib/data/validation-evidence", () => ({ getValidationEvidenceSummary: vi.fn() }));
vi.mock("@/lib/diagnostics/builder-weakness", () => ({ getBuilderWeaknessReport: vi.fn() }));

import { getProductionRunbook } from "@/lib/diagnostics/production-runbook";
import { getContentGrowthDashboard } from "@/lib/data/content-growth-dashboard";
import { getValidationEvidenceSummary } from "@/lib/data/validation-evidence";
import { getBuilderWeaknessReport } from "@/lib/diagnostics/builder-weakness";

const EMPTY_EVIDENCE = {
  totalRows: 0,
  totalPass: 0,
  totalFail: 0,
  totalInsufficient: 0,
  byContentType: [],
  bySourceHost: [],
  byField: [],
  bySourceRole: [],
  topInsufficientReasons: [],
  recent: [],
};

beforeEach(() => {
  resetPrismaMock();
  vi.mocked(getContentGrowthDashboard).mockResolvedValue([]);
  vi.mocked(getValidationEvidenceSummary).mockResolvedValue(EMPTY_EVIDENCE as never);
  vi.mocked(getBuilderWeaknessReport).mockResolvedValue([]);
  prismaMock.ingestionSource.findMany.mockResolvedValue([]);
});

describe("getProductionRunbook", () => {
  it("lists stalled content types with the automatic next action", async () => {
    vi.mocked(getContentGrowthDashboard).mockResolvedValue([
      {
        contentType: "Novena",
        currentStallReason: "no_source_documents_fetched",
        persistedPackageCount: 0,
        publicPackageCount: 0,
      },
    ] as never);

    const runbook = await getProductionRunbook();
    expect(runbook.stalledContentTypes).toEqual([
      {
        contentType: "Novena",
        stallReason: "no_source_documents_fetched",
        nextAction: "enqueue_source_discovery",
      },
    ]);
  });

  it("flags persisted-but-not-public content types as display failures", async () => {
    vi.mocked(getContentGrowthDashboard).mockResolvedValue([
      {
        contentType: "Saint",
        currentStallReason: "",
        persistedPackageCount: 10,
        publicPackageCount: 6,
      },
    ] as never);

    const runbook = await getProductionRunbook();
    expect(runbook.failingPublicDisplay).toEqual([
      { contentType: "Saint", persisted: 10, public: 6 },
    ]);
  });

  it("lists paused sources, weak builders and missing validation evidence", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        host: "bad.example",
        role: "discovery_only_source",
        pausedAt: new Date(),
        pausedReason: "low quality",
        autoPaused: false,
        autoPausedAt: null,
        roleLastReason: null,
        roleLastChangedAt: null,
      },
    ]);
    vi.mocked(getBuilderWeaknessReport).mockResolvedValue([
      {
        builderName: "NovenaBuilder",
        contentType: "Novena",
        missingField: "day7",
        failureCount: 5,
        message: "NovenaBuilder day parser weakness",
        sampleSourceUrls: [],
      },
    ] as never);
    vi.mocked(getValidationEvidenceSummary).mockResolvedValue({
      ...EMPTY_EVIDENCE,
      byContentType: [{ contentType: "Saint", pass: 1, fail: 0, insufficient: 4 }],
    } as never);

    const runbook = await getProductionRunbook();
    expect(runbook.pausedSources[0]).toMatchObject({ host: "bad.example", reason: "low quality" });
    expect(runbook.weakBuilders[0].builderName).toBe("NovenaBuilder");
    expect(runbook.missingValidationEvidence).toEqual([{ contentType: "Saint", insufficient: 4 }]);
  });
});
