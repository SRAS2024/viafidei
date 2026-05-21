/**
 * Scheduler health.
 *
 * Pins section 18: each planner tick is recorded, and a failed tick
 * surfaces the precise cause — not just "tick failed".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { recordSchedulerTick, getSchedulerHealth } from "@/lib/diagnostics/scheduler-health";
import type { PlannerSummary } from "@/lib/ingestion/queue/planner";

function plannerSummary(overrides: Partial<PlannerSummary> = {}): PlannerSummary {
  return {
    jobsScanned: 0,
    jobsEnqueued: 0,
    jobsSkippedAlreadyQueued: 0,
    jobsSkippedSourcePaused: 0,
    jobsSkippedJobPaused: 0,
    jobsSkippedContentTypePaused: 0,
    jobsSkippedSourceUnhealthy: 0,
    jobsSkippedSourceExhausted: 0,
    jobsSkippedSourceNotConfigured: 0,
    jobsSkippedDailyCap: 0,
    jobsSkippedFillCap: 0,
    promotedToConstant: 0,
    assignedToMaintenance: 0,
    mode: "constant",
    dbError: false,
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
});

describe("recordSchedulerTick", () => {
  it("records a completed tick when the planner summary is ok", async () => {
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    await recordSchedulerTick({
      summary: plannerSummary({ jobsScanned: 10, jobsEnqueued: 4, jobsSkippedAlreadyQueued: 2 }),
      durationMs: 120,
    });

    const call = prismaMock.queueAuditLog.create.mock.calls[0][0];
    expect(call.data.event).toBe("scheduler.tick_completed");
    expect(call.data.metadata.jobsEnqueued).toBe(4);
    expect(call.data.metadata.jobsSkipped).toBe(2);
  });

  it("records a failed tick when the planner returned no summary", async () => {
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    await recordSchedulerTick({ summary: null, durationMs: 50 });

    const call = prismaMock.queueAuditLog.create.mock.calls[0][0];
    expect(call.data.event).toBe("scheduler.tick_failed");
  });

  it("records a failed tick when the planner reported a db error", async () => {
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    await recordSchedulerTick({
      summary: plannerSummary({ dbError: true, errorMessage: "could not reach database" }),
      durationMs: 30,
    });

    const call = prismaMock.queueAuditLog.create.mock.calls[0][0];
    expect(call.data.event).toBe("scheduler.tick_failed");
    expect(call.data.reason).toBe("could not reach database");
  });
});

describe("getSchedulerHealth", () => {
  it("surfaces the exact last-failure reason", async () => {
    const now = new Date("2026-05-21T12:00:00Z");
    prismaMock.queueAuditLog.findMany.mockResolvedValue([
      {
        event: "scheduler.tick_failed",
        reason: "DB advisory lock timeout",
        metadata: { jobsEnqueued: 0, jobsScanned: 0, mode: "constant" },
        createdAt: new Date(now.getTime() - 60_000),
      },
      {
        event: "scheduler.tick_completed",
        reason: "tick completed",
        metadata: { jobsEnqueued: 5, jobsScanned: 12, mode: "constant" },
        createdAt: new Date(now.getTime() - 600_000),
      },
    ]);

    const h = await getSchedulerHealth(now);

    expect(h.ticked24h).toBe(true);
    expect(h.lastTickOk).toBe(false);
    expect(h.lastFailureReason).toBe("DB advisory lock timeout");
    expect(h.lastSuccessfulTickAt).toEqual(new Date(now.getTime() - 600_000));
  });

  it("reports no tick in 24h when no scheduler ticks exist", async () => {
    prismaMock.queueAuditLog.findMany.mockResolvedValue([]);

    const h = await getSchedulerHealth();

    expect(h.ticked24h).toBe(false);
    expect(h.lastTickAt).toBeNull();
    expect(h.lastTickOk).toBeNull();
  });
});
