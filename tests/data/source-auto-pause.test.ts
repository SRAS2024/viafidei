import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({
  readAdminEmail: vi.fn().mockReturnValue(null),
  sendCriticalFailureAlert: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
}));

import { autoEvaluateSourcePauses, resumeAutoPausedSource } from "@/lib/data/source-auto-pause";

beforeEach(() => {
  resetPrismaMock();
});

describe("source auto-pause", () => {
  it("pauses sources with too many consecutive failures", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src1",
        name: "Bad source",
        host: "bad.example.com",
        consecutiveFailures: 10,
        lowQualityRatio: 0.1,
        lastFailedSync: new Date(),
      },
    ]);
    prismaMock.ingestionSource.update.mockResolvedValue({});
    const result = await autoEvaluateSourcePauses();
    expect(result.paused).toContain("src1");
    expect(prismaMock.ingestionSource.update).toHaveBeenCalled();
    const updateCall = prismaMock.ingestionSource.update.mock.calls[0][0];
    expect(updateCall.data.autoPaused).toBe(true);
    expect(updateCall.data.healthState).toBe("paused");
    expect(updateCall.data.pausedReason).toMatch(/consecutive failures/);
  });

  it("pauses sources with too low quality", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src2",
        name: "Low quality",
        host: "lq.example.com",
        consecutiveFailures: 0,
        lowQualityRatio: 0.85,
      },
    ]);
    prismaMock.ingestionSource.update.mockResolvedValue({});
    const result = await autoEvaluateSourcePauses();
    expect(result.paused).toContain("src2");
    const call = prismaMock.ingestionSource.update.mock.calls[0][0];
    expect(call.data.pausedReason).toMatch(/low-quality ratio/);
  });

  it("does nothing when no sources cross the thresholds", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const result = await autoEvaluateSourcePauses();
    expect(result.paused).toEqual([]);
  });

  it("resumeAutoPausedSource clears the auto-pause + failure counters", async () => {
    prismaMock.ingestionSource.update.mockResolvedValue({});
    await resumeAutoPausedSource("src1");
    const call = prismaMock.ingestionSource.update.mock.calls[0][0];
    expect(call.data.autoPaused).toBe(false);
    expect(call.data.consecutiveFailures).toBe(0);
    expect(call.data.healthState).toBe("active");
    expect(call.data.pausedAt).toBeNull();
  });
});
