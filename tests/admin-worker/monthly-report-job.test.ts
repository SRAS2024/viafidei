/**
 * Monthly report job — proves "monthly worker report emails are sent"
 * and "monthly report is generated even for February and shorter
 * months" (spec sections 13, 24).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/pdf", () => ({
  generateMonthlyAdminWorkerReportPdf: vi.fn(async () => Buffer.from("PDF-1.4-fake")),
}));

vi.mock("@/lib/email/admin-send", () => ({
  sendAdminWorkerMonthlyReport: vi.fn(async () => ({ ok: true, delivery: "sent" }) as const),
}));

import { runMonthlyReportJobIfDue } from "@/lib/admin-worker/monthly-report-job";
import { sendAdminWorkerMonthlyReport } from "@/lib/email/admin-send";

function makePrisma() {
  return {
    adminWorkerPass: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    adminWorkerLog: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({})) },
    adminWorkerSourceReputation: { findMany: vi.fn(async () => []) },
    contentGoal: { findMany: vi.fn(async () => []) },
    homepageWorkerDraft: { count: vi.fn(async () => 0) },
    securityEvent: { count: vi.fn(async () => 0) },
    adminWorkerSecurityAction: { count: vi.fn(async () => 0) },
  } as unknown as Parameters<typeof runMonthlyReportJobIfDue>[0];
}

describe("runMonthlyReportJobIfDue", () => {
  it("skips when today is not the last day of the month", async () => {
    const out = await runMonthlyReportJobIfDue(makePrisma(), {
      now: new Date(2025, 4, 15),
    });
    expect(out.ran).toBe(false);
    expect(sendAdminWorkerMonthlyReport).not.toHaveBeenCalled();
  });

  it("runs on the last day of a normal month (Jan 31)", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const out = await runMonthlyReportJobIfDue(makePrisma(), {
      now: new Date(2025, 0, 31),
    });
    expect(out.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("runs on Feb 28 of a non-leap year", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const out = await runMonthlyReportJobIfDue(makePrisma(), {
      now: new Date(2023, 1, 28),
    });
    expect(out.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("runs on Feb 29 of a leap year", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const out = await runMonthlyReportJobIfDue(makePrisma(), {
      now: new Date(2024, 1, 29),
    });
    expect(out.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("force=true bypasses the last-day gate", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const out = await runMonthlyReportJobIfDue(makePrisma(), {
      now: new Date(2025, 4, 15),
      force: true,
    });
    expect(out.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });
});
