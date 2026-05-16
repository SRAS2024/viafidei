import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

vi.mock("@/lib/email", () => ({
  readAdminEmail: vi.fn(),
  sendThresholdMilestoneAlert: vi.fn().mockResolvedValue({ ok: true, delivery: "sent" }),
  sendBiweeklyAdminReport: vi.fn().mockResolvedValue({ ok: false }),
  sendMonthlyArchiveCleanupReport: vi.fn().mockResolvedValue({ ok: false }),
  sendMonthlyErrorReport: vi.fn().mockResolvedValue({ ok: false }),
  sendCriticalFailureAlert: vi.fn().mockResolvedValue({ ok: false }),
  sendSecurityBreachAlert: vi.fn().mockResolvedValue({ ok: false }),
  buildTextPdfBase64: vi.fn().mockReturnValue(""),
  CONTENT_TYPE_ROWS: [],
}));

import { processMilestoneNotifications } from "@/lib/data/admin-notifications";
import { appConfig } from "@/lib/config";
import * as emailModule from "@/lib/email";

const readAdminEmailMock = vi.mocked(emailModule.readAdminEmail);
const sendMock = vi.mocked(emailModule.sendThresholdMilestoneAlert);

beforeEach(() => {
  resetPrismaMock();
  sendMock.mockClear();
  readAdminEmailMock.mockReset();
});

describe("threshold milestone state updates even when ADMIN_EMAIL is missing", () => {
  it("records milestones in state without sending email when ADMIN_EMAIL is unset", async () => {
    readAdminEmailMock.mockReturnValue(null);

    // 100% complete for prayers — every threshold should be marked
    // even though no email is sent.
    prismaMock.prayer.count.mockResolvedValue(appConfig.ingestion.targets.prayers);
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);

    prismaMock.adminNotificationState.findUnique.mockResolvedValue(null);
    prismaMock.adminNotificationState.upsert.mockResolvedValue({});

    const result = await processMilestoneNotifications();

    expect(sendMock).not.toHaveBeenCalled();
    expect(result.sent).toHaveLength(0);
    expect(result.recordedWithoutSend.length).toBeGreaterThan(0);
    // Prayers is at 100% — all four thresholds (25/50/75/100) should be
    // marked.
    const prayerRecords = result.recordedWithoutSend.filter((r) => r.bucket === "prayers");
    expect(prayerRecords.map((r) => r.threshold).sort((a, b) => a - b)).toEqual([25, 50, 75, 100]);
    // State must have been upserted so a later ADMIN_EMAIL flip does
    // not fire all four at once.
    expect(prismaMock.adminNotificationState.upsert).toHaveBeenCalled();
  });

  it("sends and records when ADMIN_EMAIL is configured", async () => {
    readAdminEmailMock.mockReturnValue("admin@example.com");

    prismaMock.prayer.count.mockResolvedValue(appConfig.ingestion.targets.prayers);
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);

    prismaMock.adminNotificationState.findUnique.mockResolvedValue(null);
    prismaMock.adminNotificationState.upsert.mockResolvedValue({});

    const result = await processMilestoneNotifications();
    expect(sendMock).toHaveBeenCalled();
    expect(result.sent.length).toBeGreaterThan(0);
  });
});
