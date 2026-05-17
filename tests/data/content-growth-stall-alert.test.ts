/**
 * Section 12: "content growth stall alerts fire." Verifies
 * `checkStalledGrowth` fires an alert after `cycleThreshold`
 * consecutive ticks with no growth while below target.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const hoisted = vi.hoisted(() => ({
  sendCriticalFailureAlertMock: vi.fn(),
}));
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    readAdminEmail: () => "admin@example.com",
    sendCriticalFailureAlert: hoisted.sendCriticalFailureAlertMock,
  };
});

import { checkStalledGrowth } from "@/lib/data/ingestion-alerts";

beforeEach(() => {
  resetPrismaMock();
  hoisted.sendCriticalFailureAlertMock.mockReset();
  hoisted.sendCriticalFailureAlertMock.mockResolvedValue({ ok: true, delivery: "sent" });
  prismaMock.adminNotificationState.findUnique.mockResolvedValue(null);
  prismaMock.adminNotificationState.upsert.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("content growth stall alerts", () => {
  it("fires after the cycle threshold passes without growth", async () => {
    // Use an existing state with cyclesNoGrowth = 5 so one more
    // no-growth tick takes us to 6, the default threshold.
    prismaMock.adminNotificationState.findUnique.mockResolvedValue({
      flow: "alert:stalled:prayers",
      state: {
        lastSentAt: null,
        counter: 0,
        lastCount: 100,
        cyclesNoGrowth: 5,
      },
    });
    const fired = await checkStalledGrowth({
      key: "prayers",
      label: "Prayers",
      currentCount: 100, // unchanged from previous tick
      target: 500,
    });
    expect(fired).toBe(true);
    expect(hoisted.sendCriticalFailureAlertMock).toHaveBeenCalled();
  });

  it("does not fire when the bucket grew", async () => {
    prismaMock.adminNotificationState.findUnique.mockResolvedValue({
      flow: "alert:stalled:prayers",
      state: {
        lastSentAt: null,
        counter: 0,
        lastCount: 100,
        cyclesNoGrowth: 5,
      },
    });
    const fired = await checkStalledGrowth({
      key: "prayers",
      label: "Prayers",
      currentCount: 150, // grew this tick
      target: 500,
    });
    expect(fired).toBe(false);
  });

  it("does not fire when the bucket has already met its target", async () => {
    prismaMock.adminNotificationState.findUnique.mockResolvedValue({
      flow: "alert:stalled:prayers",
      state: {
        lastSentAt: null,
        counter: 0,
        lastCount: 500,
        cyclesNoGrowth: 10,
      },
    });
    const fired = await checkStalledGrowth({
      key: "prayers",
      label: "Prayers",
      currentCount: 500, // at target — no need to fire
      target: 500,
    });
    expect(fired).toBe(false);
  });
});
