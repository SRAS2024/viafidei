/**
 * Strict QA admin alerts. Verifies each alert fires under its trigger
 * condition and respects its 24-hour cooldown.
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

import { runStrictQAAlerts } from "@/lib/data/strict-qa-alerts";

beforeEach(() => {
  resetPrismaMock();
  hoisted.sendCriticalFailureAlertMock.mockReset();
  hoisted.sendCriticalFailureAlertMock.mockResolvedValue({ ok: true, delivery: "sent" });
  prismaMock.adminNotificationState.findUnique.mockResolvedValue(null);
  prismaMock.adminNotificationState.upsert.mockResolvedValue({});
  prismaMock.errorLog.create.mockResolvedValue({});
  // Healthy defaults so each test enables exactly one alert.
  prismaMock.dataManagementLog.findFirst.mockResolvedValue({
    createdAt: new Date(),
    action: "CLEANUP",
    contentType: "ContentQA",
  });
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.parish,
    prismaMock.devotion,
    prismaMock.liturgyEntry,
    prismaMock.spiritualLifeGuide,
    prismaMock.marianApparition,
    prismaMock.ingestionJobQueue,
    prismaMock.workerHeartbeat,
    prismaMock.ingestionSource,
    prismaMock.rejectedContentLog,
  ]) {
    m.count.mockResolvedValue(0);
  }
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runStrictQAAlerts", () => {
  it("fires invalid_public_rows alert when count > 0", async () => {
    prismaMock.prayer.count.mockResolvedValue(5);
    const result = await runStrictQAAlerts();
    expect(result.invalidPublicAlerted).toBe(true);
    const kinds = hoisted.sendCriticalFailureAlertMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toContain("strict_qa_invalid_public_rows");
  });

  it("also writes the alert to ErrorLog so the monthly error report picks it up", async () => {
    prismaMock.prayer.count.mockResolvedValue(5);
    await runStrictQAAlerts();
    const errorKinds = prismaMock.errorLog.create.mock.calls.map((c) => c[0].data.kind);
    expect(errorKinds).toContain("strict_qa.invalid_public_rows");
  });

  it("fires stale_cleanup alert when no CLEANUP log row exists", async () => {
    prismaMock.dataManagementLog.findFirst.mockResolvedValue(null);
    const result = await runStrictQAAlerts();
    expect(result.staleCleanupAlerted).toBe(true);
    const kinds = hoisted.sendCriticalFailureAlertMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toContain("strict_qa_stale_cleanup");
  });

  it("fires rejection_spike alert when last-hour deletes are 5x the prior 23h average", async () => {
    // Mock count for "last hour" (gte hourAgo) → 60 deletes; "prior 23h"
    // (gte dayAgo, lt hourAgo) → 23 deletes (so 1/hour average).
    let call = 0;
    prismaMock.rejectedContentLog.count.mockImplementation(async () => {
      call += 1;
      // Call order: lastHour (60), lastDay (23) — and the
      // getCleanupHealth helper calls also hit count (returning 0).
      if (call === 1) return 0; // cleanup health "deletedLast24h"
      if (call === 2) return 0; // cleanup health "deletedLast7d"
      if (call === 3) return 60; // alert lastHour
      if (call === 4) return 23; // alert prior 23h
      return 0;
    });
    const result = await runStrictQAAlerts();
    expect(result.rejectionSpikeAlerted).toBe(true);
  });

  it("respects 24h cooldown — does not fire twice in a row", async () => {
    prismaMock.prayer.count.mockResolvedValue(5);
    prismaMock.adminNotificationState.findUnique.mockResolvedValue({
      flow: "alert:strict_qa:invalid_public_rows",
      state: { lastSentAt: new Date().toISOString(), counter: 1 },
    });
    const result = await runStrictQAAlerts();
    expect(result.invalidPublicAlerted).toBe(false);
  });

  it("never throws when sub-queries fail", async () => {
    prismaMock.dataManagementLog.findFirst.mockRejectedValue(new Error("db down"));
    prismaMock.rejectedContentLog.count.mockRejectedValue(new Error("db down"));
    await expect(runStrictQAAlerts()).resolves.toBeDefined();
  });
});
