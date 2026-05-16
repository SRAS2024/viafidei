import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

vi.mock("@/lib/db/tables", () => ({
  checkRequiredTables: vi.fn(),
  checkSeedContent: vi.fn(),
}));

import { runDataManagementDiagnostics } from "@/lib/diagnostics/data-management";
import { checkRequiredTables, checkSeedContent } from "@/lib/db/tables";

const checkRequiredTablesMock = vi.mocked(checkRequiredTables);
const checkSeedContentMock = vi.mocked(checkSeedContent);

beforeEach(() => {
  resetPrismaMock();
  checkRequiredTablesMock.mockReset();
  checkSeedContentMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runDataManagementDiagnostics", () => {
  it("reports fail when required tables are missing", async () => {
    checkRequiredTablesMock.mockResolvedValue({
      ok: false,
      missing: ["Prayer", "Saint"],
      present: [],
      publicContentMissing: [],
      columnsMissing: [],
    });
    checkSeedContentMock.mockResolvedValue({ ok: true, counts: {} });
    prismaMock.ingestionJobRun.count.mockResolvedValue(0);
    prismaMock.dataManagementLog.count.mockResolvedValue(0);
    const section = await runDataManagementDiagnostics();
    const tablesResult = section.results.find((r) => r.id === "dm.tables");
    expect(tablesResult?.severity).toBe("fail");
    expect(String(tablesResult?.evidence?.missing)).toContain("Prayer");
    expect(section.severity).toBe("fail");
  });

  it("reports pass with healthy counters when everything is up to baseline", async () => {
    checkRequiredTablesMock.mockResolvedValue({
      ok: true,
      missing: [],
      present: ["Prayer", "Saint", "Parish"],
      publicContentMissing: [],
      columnsMissing: [],
    });
    checkSeedContentMock.mockResolvedValue({
      ok: true,
      counts: { Prayer: 12, Saint: 50, Parish: 100 },
    });
    // total=5, failed=0, reviewRequired=0 — clean.
    prismaMock.ingestionJobRun.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.dataManagementLog.count.mockResolvedValue(2);
    const section = await runDataManagementDiagnostics();
    expect(section.severity).toBe("pass");
    expect(section.results.find((r) => r.id === "dm.content_counts")?.evidence?.totalRows).toBe(
      162,
    );
  });

  it("warns when ingestion has recent failures", async () => {
    checkRequiredTablesMock.mockResolvedValue({
      ok: true,
      missing: [],
      present: ["Prayer"],
      publicContentMissing: [],
      columnsMissing: [],
    });
    checkSeedContentMock.mockResolvedValue({ ok: true, counts: { Prayer: 5 } });
    // Three runs, one failed.
    prismaMock.ingestionJobRun.count
      .mockResolvedValueOnce(3) // total
      .mockResolvedValueOnce(1) // failed
      .mockResolvedValueOnce(0); // review required
    prismaMock.dataManagementLog.count.mockResolvedValue(0);
    const section = await runDataManagementDiagnostics();
    const runs = section.results.find((r) => r.id === "dm.recent_runs");
    expect(runs?.severity).toBe("warn");
    expect(runs?.evidence?.failed).toBe(1);
    expect(section.severity).toBe("warn");
  });

  /**
   * Helper that pre-arms every mock the section walks through so the
   * test can focus on one probe at a time. The defaults are "healthy":
   * required tables present, content above baseline, no recent failures,
   * empty 24h log totals + groupBy. Individual tests override what they
   * care about.
   */
  function arrangeHealthy() {
    checkRequiredTablesMock.mockResolvedValue({
      ok: true,
      missing: [],
      present: ["Prayer"],
      publicContentMissing: [],
      columnsMissing: [],
    });
    checkSeedContentMock.mockResolvedValue({ ok: true, counts: { Prayer: 10 } });
    prismaMock.ingestionJobRun.count
      .mockResolvedValueOnce(2) // total
      .mockResolvedValueOnce(0) // failed
      .mockResolvedValueOnce(0); // reviewRequired
    prismaMock.dataManagementLog.count.mockResolvedValue(0);
  }

  it("includes the janitor activity probe with repackaged / hard-deleted / diverted counts", async () => {
    arrangeHealthy();
    // groupBy is called twice — once for janitor rows (with the
    // Janitor: reason filter), once for the unrestricted pipeline
    // rollup. The first call drives dm.janitor_activity.
    prismaMock.dataManagementLog.groupBy
      .mockResolvedValueOnce([
        { action: "UPDATE", _count: { _all: 7 } },
        { action: "DELETE", _count: { _all: 3 } },
        { action: "CATEGORY_FIX", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([]);

    const section = await runDataManagementDiagnostics();
    const probe = section.results.find((r) => r.id === "dm.janitor_activity");
    expect(probe).toBeDefined();
    expect(probe?.severity).toBe("pass");
    expect(probe?.evidence?.repackaged).toBe(7);
    expect(probe?.evidence?.hardDeleted).toBe(3);
    expect(probe?.evidence?.divertedToReview).toBe(1);
    expect(probe?.summary).toContain("7 repackaged");
    expect(probe?.summary).toContain("3 hard-deleted");
    expect(probe?.summary).toContain("1 diverted to REVIEW");
  });

  it("reports zero janitor activity when the log has no Janitor rows in the window", async () => {
    arrangeHealthy();
    prismaMock.dataManagementLog.groupBy.mockResolvedValue([]);
    const section = await runDataManagementDiagnostics();
    const probe = section.results.find((r) => r.id === "dm.janitor_activity");
    expect(probe?.evidence).toEqual({
      repackaged: 0,
      hardDeleted: 0,
      divertedToReview: 0,
    });
  });

  it("reports a healthy ingestion pipeline rollup", async () => {
    arrangeHealthy();
    // First groupBy is the Janitor filter, second is the unrestricted
    // pipeline rollup that dm.ingestion_pipeline reads from.
    prismaMock.dataManagementLog.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { action: "ADD", _count: { _all: 42 } },
      { action: "UPDATE", _count: { _all: 8 } },
      { action: "DELETE", _count: { _all: 2 } },
      { action: "CATEGORY_FIX", _count: { _all: 5 } },
      { action: "REJECT", _count: { _all: 1 } },
    ]);

    const section = await runDataManagementDiagnostics();
    const probe = section.results.find((r) => r.id === "dm.ingestion_pipeline");
    expect(probe).toBeDefined();
    expect(probe?.severity).toBe("pass");
    expect(probe?.summary).toContain("42 added");
    expect(probe?.summary).toContain("8 updated");
    expect(probe?.summary).toContain("2 deleted");
    expect(probe?.summary).toContain("5 re-classified");
    expect(probe?.summary).toContain("1 rejected");
    expect(probe?.evidence).toMatchObject({
      ADD: 42,
      UPDATE: 8,
      DELETE: 2,
      CATEGORY_FIX: 5,
      REJECT: 1,
    });
  });

  it("reports adapter coverage from the secondary-host metadata", async () => {
    arrangeHealthy();
    prismaMock.dataManagementLog.groupBy.mockResolvedValue([]);
    const section = await runDataManagementDiagnostics();
    const probe = section.results.find((r) => r.id === "dm.adapter_coverage");
    expect(probe).toBeDefined();
    expect(probe?.severity).toBe("pass");
    // The metadata table is hard-coded; both counts must be positive
    // integers regardless of how the table evolves later.
    const adapters = Number(probe?.evidence?.adapters ?? 0);
    const secondaryHosts = Number(probe?.evidence?.secondaryHosts ?? 0);
    expect(adapters).toBeGreaterThan(0);
    expect(secondaryHosts).toBeGreaterThan(0);
  });
});
