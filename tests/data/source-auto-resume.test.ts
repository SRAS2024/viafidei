/**
 * Source auto-resume tests. Verifies temporary failures get retried
 * once a freshness probe succeeds, and structurally-bad sources stay
 * paused regardless.
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

import {
  autoResumeRecoveredSources,
  notifyStructurallyBadSources,
} from "@/lib/data/source-auto-pause";

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

describe("autoResumeRecoveredSources", () => {
  it("resumes a temporarily-paused source that has a fresh successful sync", async () => {
    const pausedAt = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8h ago
    const success = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src-1",
        name: "OK source",
        host: "ok.example",
        autoPaused: true,
        autoPausedAt: pausedAt,
        pausedReason: "Auto-paused after 8 consecutive failures",
        lowQualityRatio: 0.1,
        consecutiveFailures: 0,
        lastSuccessfulSync: success,
      },
    ]);
    const result = await autoResumeRecoveredSources();
    expect(result.resumed).toContain("src-1");
    expect(prismaMock.ingestionSource.update).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: expect.objectContaining({
        pausedAt: null,
        autoPaused: false,
        consecutiveFailures: 0,
      }),
    });
  });

  it("does NOT resume a low-quality (structurally-bad) source", async () => {
    const pausedAt = new Date(Date.now() - 8 * 60 * 60 * 1000);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src-bad",
        name: "Bad source",
        host: "bad.example",
        autoPaused: true,
        autoPausedAt: pausedAt,
        pausedReason: "Auto-paused — low-quality ratio 0.80 exceeded 0.70",
        lowQualityRatio: 0.8,
        consecutiveFailures: 0,
        lastSuccessfulSync: new Date(),
      },
    ]);
    const result = await autoResumeRecoveredSources();
    expect(result.resumed).not.toContain("src-bad");
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });

  it("does NOT resume a temporarily-paused source if it never recovered (no fresh sync)", async () => {
    const pausedAt = new Date(Date.now() - 8 * 60 * 60 * 1000);
    const lastSync = new Date(Date.now() - 24 * 60 * 60 * 1000); // before pausedAt
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src-still-bad",
        name: "Not recovered",
        host: "still-bad.example",
        autoPaused: true,
        autoPausedAt: pausedAt,
        pausedReason: "Auto-paused after 8 consecutive failures",
        lowQualityRatio: 0.1,
        consecutiveFailures: 5, // still failing
        lastSuccessfulSync: lastSync,
      },
    ]);
    const result = await autoResumeRecoveredSources();
    expect(result.resumed).toHaveLength(0);
  });

  it("does not even consider sources paused less than 6 hours ago", async () => {
    const result = await autoResumeRecoveredSources();
    // The findMany where clause already filters by autoPausedAt range.
    const args = prismaMock.ingestionSource.findMany.mock.calls[0][0];
    expect(args.where.autoPausedAt).toBeDefined();
    expect(result.resumed).toEqual([]);
  });
});

describe("notifyStructurallyBadSources", () => {
  it("notifies the admin when a structurally-bad source has been paused for >7 days", async () => {
    const oldPause = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src-old-bad",
        name: "Long-paused bad source",
        host: "longbad.example",
        autoPaused: true,
        autoPausedAt: oldPause,
        lowQualityRatio: 0.9,
        healthState: "paused",
      },
    ]);
    const result = await notifyStructurallyBadSources();
    expect(result.notified).toContain("src-old-bad");
    expect(hoisted.sendCriticalFailureAlertMock).toHaveBeenCalled();
    const args = hoisted.sendCriticalFailureAlertMock.mock.calls[0][0];
    expect(args.kind).toBe("source_structurally_bad");
  });
});
