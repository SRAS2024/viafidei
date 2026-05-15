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
});
