/**
 * Monthly report job — proves "monthly worker report emails are sent"
 * and "monthly report is generated even for February and shorter
 * months" (spec sections 13, 24), PLUS the reliability contract added
 * after the June 2026 report silently never sent:
 *   - the job is idempotent per month (durable marker; at most one email
 *     no matter how many passes hit the month-end gate),
 *   - a MISSED month-end is caught up on a later pass (the original bug:
 *     the check ran only at process startup, so a continuously-running
 *     worker never fired it),
 *   - catch-up never mails an empty report for a month the worker
 *     didn't run,
 *   - a failed send retries only after a cooldown, never on every pass.
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

function makePrisma(
  opts: {
    /** Rows the durable month-marker lookup returns (by matching tag). */
    markers?: Array<{ tag: string; status: string; generatedAt: Date }>;
    /** Worker passes counted in the previous-month activity guard. */
    prevMonthPasses?: number;
  } = {},
) {
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    adminWorkerPass: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => opts.prevMonthPasses ?? 0),
    },
    adminWorkerLog: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({})) },
    adminWorkerSourceReputation: { findMany: vi.fn(async () => []) },
    contentGoal: { findMany: vi.fn(async () => []) },
    homepageWorkerDraft: { count: vi.fn(async () => 0) },
    securityEvent: { count: vi.fn(async () => 0) },
    adminWorkerSecurityAction: { count: vi.fn(async () => 0) },
    adminDeveloperReportLog: {
      findFirst: vi.fn(
        async (args: { where: { includedSections?: { has?: string } } }) =>
          opts.markers?.find((m) => m.tag === args.where.includedSections?.has) ?? null,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { id: "rl1" };
      }),
    },
  } as unknown as Parameters<typeof runMonthlyReportJobIfDue>[0];
  return { prisma, created };
}

describe("runMonthlyReportJobIfDue", () => {
  it("skips mid-month when the previous month's report was already sent", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const { prisma } = makePrisma({
      markers: [{ tag: "MONTH:2025-04", status: "GENERATED", generatedAt: new Date(2025, 3, 30) }],
      prevMonthPasses: 100,
    });
    const out = await runMonthlyReportJobIfDue(prisma, { now: new Date(2025, 4, 15) });
    expect(out.ran).toBe(false);
    expect(sendAdminWorkerMonthlyReport).not.toHaveBeenCalled();
  });

  it("runs on the last day of a normal month (Jan 31) and records the durable month marker", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const { prisma, created } = makePrisma();
    const out = await runMonthlyReportJobIfDue(prisma, { now: new Date(2025, 0, 31) });
    expect(out.ran).toBe(true);
    expect(out.delivery).toBe("sent");
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
    expect(created[0]).toMatchObject({
      status: "GENERATED",
      includedSections: ["MONTH:2025-01"],
    });
  });

  it("runs on Feb 28 of a non-leap year", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const out = await runMonthlyReportJobIfDue(makePrisma().prisma, {
      now: new Date(2023, 1, 28),
    });
    expect(out.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("runs on Feb 29 of a leap year", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const out = await runMonthlyReportJobIfDue(makePrisma().prisma, {
      now: new Date(2024, 1, 29),
    });
    expect(out.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("is IDEMPOTENT: a second pass on the same month-end never double-sends", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const { prisma } = makePrisma({
      markers: [{ tag: "MONTH:2025-01", status: "GENERATED", generatedAt: new Date(2025, 0, 31) }],
    });
    const out = await runMonthlyReportJobIfDue(prisma, { now: new Date(2025, 0, 31) });
    expect(out.ran).toBe(false);
    expect(sendAdminWorkerMonthlyReport).not.toHaveBeenCalled();
  });

  it("CATCHES UP a missed month-end on a later pass (the June-report-never-arrived bug)", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    // July 10, June's marker absent, worker ran in June → send June late.
    const { prisma, created } = makePrisma({ prevMonthPasses: 5000 });
    const out = await runMonthlyReportJobIfDue(prisma, { now: new Date(Date.UTC(2026, 6, 10)) });
    expect(out.ran).toBe(true);
    expect(out.reason).toContain("catch-up");
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendAdminWorkerMonthlyReport).mock.calls[0][0];
    expect(call.monthStart.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(call.monthEnd.toISOString().slice(0, 10)).toBe("2026-06-30");
    expect(created[0]).toMatchObject({ includedSections: ["MONTH:2026-06"] });
  });

  it("catch-up NEVER mails a report for a month the worker did not run (fresh install)", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const { prisma } = makePrisma({ prevMonthPasses: 0 });
    const out = await runMonthlyReportJobIfDue(prisma, { now: new Date(Date.UTC(2026, 6, 10)) });
    expect(out.ran).toBe(false);
    expect(sendAdminWorkerMonthlyReport).not.toHaveBeenCalled();
  });

  it("a FAILED attempt retries only after the cooldown, not on every pass", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const nowMs = Date.UTC(2025, 0, 31, 12, 0, 0);
    // Failed 5 minutes ago → still cooling down, no retry.
    const { prisma: cooling } = makePrisma({
      markers: [
        { tag: "MONTH:2025-01", status: "FAILED", generatedAt: new Date(nowMs - 5 * 60_000) },
      ],
    });
    const during = await runMonthlyReportJobIfDue(cooling, { now: new Date(nowMs) });
    expect(during.ran).toBe(false);
    expect(sendAdminWorkerMonthlyReport).not.toHaveBeenCalled();

    // Failed 7 hours ago → cooldown elapsed, retry fires.
    const { prisma: cooled } = makePrisma({
      markers: [
        {
          tag: "MONTH:2025-01",
          status: "FAILED",
          generatedAt: new Date(nowMs - 7 * 60 * 60_000),
        },
      ],
    });
    const after = await runMonthlyReportJobIfDue(cooled, { now: new Date(nowMs) });
    expect(after.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("force=true bypasses the gates entirely", async () => {
    vi.mocked(sendAdminWorkerMonthlyReport).mockClear();
    const out = await runMonthlyReportJobIfDue(makePrisma().prisma, {
      now: new Date(2025, 4, 15),
      force: true,
    });
    expect(out.ran).toBe(true);
    expect(sendAdminWorkerMonthlyReport).toHaveBeenCalledTimes(1);
  });
});
