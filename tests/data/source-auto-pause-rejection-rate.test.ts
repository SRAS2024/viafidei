/**
 * Section 12: "source pausing works after high rejection rate."
 * Verifies `autoEvaluateSourcePauses` pauses a source whose
 * lowQualityRatio exceeds the threshold (rejection-rate proxy) and
 * whose consecutiveFailures spike beyond the configured ceiling.
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

import { autoEvaluateSourcePauses } from "@/lib/data/source-auto-pause";

beforeEach(() => {
  resetPrismaMock();
  hoisted.sendCriticalFailureAlertMock.mockReset();
  hoisted.sendCriticalFailureAlertMock.mockResolvedValue({ ok: true, delivery: "sent" });
  prismaMock.ingestionSource.findMany.mockResolvedValue([]);
  prismaMock.ingestionSource.update.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("source auto-pause after high rejection rate", () => {
  it("pauses a source whose lowQualityRatio exceeds threshold", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "bad-host",
        name: "Bad host",
        host: "bad.example",
        consecutiveFailures: 0,
        lowQualityRatio: 0.9,
        pausedAt: null,
        autoPaused: false,
      },
    ]);
    const result = await autoEvaluateSourcePauses();
    expect(result.paused).toContain("bad-host");
    const args = prismaMock.ingestionSource.update.mock.calls[0][0];
    expect(args.data.pausedReason).toMatch(/low-quality\s+ratio/i);
    expect(args.data.autoPaused).toBe(true);
    expect(hoisted.sendCriticalFailureAlertMock).toHaveBeenCalled();
  });

  it("pauses a source after consecutive failure spike", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "flaky-host",
        name: "Flaky host",
        host: "flaky.example",
        consecutiveFailures: 12,
        lowQualityRatio: 0,
        pausedAt: null,
        autoPaused: false,
      },
    ]);
    const result = await autoEvaluateSourcePauses();
    expect(result.paused).toContain("flaky-host");
    const args = prismaMock.ingestionSource.update.mock.calls[0][0];
    expect(args.data.pausedReason).toMatch(/consecutive\s+failures/i);
  });

  it("does NOT pause a healthy source", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const result = await autoEvaluateSourcePauses();
    expect(result.paused).toHaveLength(0);
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });
});
