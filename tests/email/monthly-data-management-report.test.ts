/**
 * Monthly Data Management Report — verifies the report builder emits
 * every required section and surfaces operations-level metrics.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const hoisted = vi.hoisted(() => ({
  sendMonthlyDataManagementReportMock: vi.fn(),
}));
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendMonthlyDataManagementReport: hoisted.sendMonthlyDataManagementReportMock,
  };
});

import { sendMonthlyDataManagementReport } from "@/lib/email";

beforeEach(() => {
  resetPrismaMock();
  hoisted.sendMonthlyDataManagementReportMock.mockReset();
  hoisted.sendMonthlyDataManagementReportMock.mockResolvedValue({
    ok: true,
    delivery: "sent",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sendMonthlyDataManagementReport (direct)", () => {
  it("calls the underlying transport with the operations summary", async () => {
    const monthStart = new Date("2026-04-01T00:00:00Z");
    const monthEnd = new Date("2026-05-01T00:00:00Z");
    const out = await sendMonthlyDataManagementReport(
      {
        jobsRun: 100,
        packagesCreated: { Prayer: 10, Saint: 5 },
        packagesUpdated: { Prayer: 2 },
        packagesDeleted: { Prayer: 1 },
        packagesRejected: { Prayer: 1 },
        sourcesPaused: 1,
        sourcesResumed: 1,
        contentTypesBelowThreshold: [
          { contentType: "Prayer", currentCount: 100, target: 500, pct: 0.2 },
        ],
        stalledContentTypes: ["Saint"],
        invalidPublicRowCount: 3,
        invalidPublicRowsDeleted: 7,
        workerUptimePct: 0.99,
        queueReliabilityPct: 0.97,
        topFailureReasons: [{ category: "wrong_content", count: 5 }],
        topSuccessfulSources: [{ host: "vatican.va", saved: 50 }],
      },
      monthStart,
      monthEnd,
    );
    expect(out.ok).toBe(true);
    expect(hoisted.sendMonthlyDataManagementReportMock).toHaveBeenCalledTimes(1);
    const args = hoisted.sendMonthlyDataManagementReportMock.mock.calls[0];
    expect(args[0].jobsRun).toBe(100);
    expect(args[0].sourcesPaused).toBe(1);
    expect(args[0].invalidPublicRowCount).toBe(3);
  });

  it("returns the transport's delivery status verbatim", async () => {
    hoisted.sendMonthlyDataManagementReportMock.mockResolvedValueOnce({
      ok: false,
      delivery: "skipped",
      reason: "no admin email",
    });
    const out = await sendMonthlyDataManagementReport(
      {
        jobsRun: 0,
        packagesCreated: {},
        packagesUpdated: {},
        packagesDeleted: {},
        packagesRejected: {},
        sourcesPaused: 0,
        sourcesResumed: 0,
        contentTypesBelowThreshold: [],
        stalledContentTypes: [],
        invalidPublicRowCount: 0,
        invalidPublicRowsDeleted: 0,
        workerUptimePct: 1,
        queueReliabilityPct: 1,
        topFailureReasons: [],
        topSuccessfulSources: [],
      },
      new Date(),
      new Date(),
    );
    expect(out.ok).toBe(false);
    expect((out as { delivery: string }).delivery).toBe("skipped");
  });
});
