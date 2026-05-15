import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const { sendBiweeklyMock, sendMonthlyArchiveMock, sendMonthlyErrorReportMock, sendThresholdMock } =
  vi.hoisted(() => ({
    sendBiweeklyMock: vi.fn(),
    sendMonthlyArchiveMock: vi.fn(),
    sendMonthlyErrorReportMock: vi.fn(),
    sendThresholdMock: vi.fn(),
  }));

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendBiweeklyAdminReport: (...args: unknown[]) => sendBiweeklyMock(...args),
    sendMonthlyArchiveCleanupReport: (...args: unknown[]) => sendMonthlyArchiveMock(...args),
    sendMonthlyErrorReport: (...args: unknown[]) => sendMonthlyErrorReportMock(...args),
    sendThresholdMilestoneAlert: (...args: unknown[]) => sendThresholdMock(...args),
    readAdminEmail: () => "ops@example.com",
  };
});

import {
  dispatchAdminNotifications,
  isLastDayOfMonth,
  processMilestoneNotifications,
} from "@/lib/data/admin-notifications";

beforeEach(() => {
  resetPrismaMock();
  sendBiweeklyMock.mockReset();
  sendMonthlyArchiveMock.mockReset();
  sendMonthlyErrorReportMock.mockReset();
  sendThresholdMock.mockReset();
  sendBiweeklyMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendMonthlyArchiveMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendMonthlyErrorReportMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendThresholdMock.mockResolvedValue({ ok: true, delivery: "sent" });
  process.env.ADMIN_EMAIL = "ops@example.com";

  // @ts-expect-error - the prisma mock doesn't include adminNotificationState
  prismaMock.adminNotificationState = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };
  // @ts-expect-error - the prisma mock doesn't include errorLog
  prismaMock.errorLog = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    create: vi.fn(),
  };
  // dataManagementLog.groupBy is needed by the biweekly aggregator.
  prismaMock.dataManagementLog.groupBy.mockResolvedValue([]);
  // milestone aggregator queries each content table
  prismaMock.prayer.count.mockResolvedValue(0);
  prismaMock.saint.count.mockResolvedValue(0);
  prismaMock.parish.count.mockResolvedValue(0);
  prismaMock.liturgyEntry.count.mockResolvedValue(0);
  prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);
});

afterEach(() => {
  delete process.env.ADMIN_EMAIL;
});

describe("isLastDayOfMonth", () => {
  it("recognises the 31st in 31-day months", () => {
    expect(isLastDayOfMonth(new Date(Date.UTC(2026, 0, 31, 12, 0, 0)))).toBe(true);
    expect(isLastDayOfMonth(new Date(Date.UTC(2026, 0, 30, 12, 0, 0)))).toBe(false);
  });

  it("recognises the 30th in 30-day months (April)", () => {
    expect(isLastDayOfMonth(new Date(Date.UTC(2026, 3, 30, 12, 0, 0)))).toBe(true);
    expect(isLastDayOfMonth(new Date(Date.UTC(2026, 3, 29, 12, 0, 0)))).toBe(false);
  });

  it("recognises the 28th in non-leap February", () => {
    expect(isLastDayOfMonth(new Date(Date.UTC(2026, 1, 28, 12, 0, 0)))).toBe(true);
    expect(isLastDayOfMonth(new Date(Date.UTC(2026, 1, 27, 12, 0, 0)))).toBe(false);
  });

  it("recognises the 29th in leap February", () => {
    expect(isLastDayOfMonth(new Date(Date.UTC(2024, 1, 29, 12, 0, 0)))).toBe(true);
    expect(isLastDayOfMonth(new Date(Date.UTC(2024, 1, 28, 12, 0, 0)))).toBe(false);
  });
});

describe("dispatchAdminNotifications biweekly cadence", () => {
  it("sends the biweekly report when there has been no prior send", async () => {
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.findUnique.mockResolvedValue(null);
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.upsert.mockResolvedValue({});
    const summary = await dispatchAdminNotifications(new Date("2026-05-15T10:00:00Z"));
    expect(sendBiweeklyMock).toHaveBeenCalledOnce();
    expect(summary.biweekly?.ok).toBe(true);
  });

  it("skips the biweekly report when sent within 14 days", async () => {
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.findUnique.mockImplementation(
      ({ where }: { where: { flow: string } }) => {
        if (where.flow === "biweekly_report") {
          return Promise.resolve({
            flow: "biweekly_report",
            state: { lastSentAt: "2026-05-14T00:00:00Z" },
          });
        }
        return Promise.resolve(null);
      },
    );
    await dispatchAdminNotifications(new Date("2026-05-15T10:00:00Z"));
    expect(sendBiweeklyMock).not.toHaveBeenCalled();
  });
});

describe("dispatchAdminNotifications monthly cadence", () => {
  it("sends the monthly archive cleanup digest only on the last day of the month", async () => {
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.findUnique.mockResolvedValue(null);
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.upsert.mockResolvedValue({});

    // Mid-month: not sent.
    await dispatchAdminNotifications(new Date("2026-05-15T10:00:00Z"));
    expect(sendMonthlyArchiveMock).not.toHaveBeenCalled();
    expect(sendMonthlyErrorReportMock).not.toHaveBeenCalled();

    sendMonthlyArchiveMock.mockClear();
    sendMonthlyErrorReportMock.mockClear();

    // Last day of May (31st): both fire.
    await dispatchAdminNotifications(new Date("2026-05-31T10:00:00Z"));
    expect(sendMonthlyArchiveMock).toHaveBeenCalledOnce();
    expect(sendMonthlyErrorReportMock).toHaveBeenCalledOnce();
  });
});

describe("processMilestoneNotifications", () => {
  it("emits exactly one alert when a content type crosses a threshold", async () => {
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.findUnique.mockResolvedValue(null);
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.upsert.mockResolvedValue({});
    // 250 prayers / 500 target = 50% → emit 25% AND 50% milestones.
    prismaMock.prayer.count.mockResolvedValue(250);
    const summary = await processMilestoneNotifications();
    const prayersSent = summary.sent.filter((s) => s.bucket === "prayers");
    expect(prayersSent.map((s) => s.threshold).sort()).toEqual([25, 50]);
  });

  it("does not re-emit a threshold that has already been sent", async () => {
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.findUnique.mockImplementation(
      ({ where }: { where: { flow: string } }) => {
        if (where.flow === "milestone:prayers") {
          return Promise.resolve({
            flow: where.flow,
            state: { sent: [25, 50] },
          });
        }
        return Promise.resolve(null);
      },
    );
    // @ts-expect-error - prisma mock surface for test
    prismaMock.adminNotificationState.upsert.mockResolvedValue({});
    prismaMock.prayer.count.mockResolvedValue(260);
    const summary = await processMilestoneNotifications();
    const prayersSent = summary.sent.filter((s) => s.bucket === "prayers");
    expect(prayersSent).toHaveLength(0);
  });
});
