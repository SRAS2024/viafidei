/**
 * Tests for the worker build queue (lease, retry-with-backoff, partial).
 */

import { describe, it, expect, vi } from "vitest";

import {
  markBuildFailedOrRetry,
  markBuildPartial,
  markBuildSucceeded,
} from "@/lib/worker/build/queue";

function makePrisma() {
  const job = { findUnique: vi.fn(), update: vi.fn() };
  return { workerBuildJob: job } as never;
}

describe("worker build queue", () => {
  it("marks succeeded clears partialPayload", async () => {
    const prisma: any = makePrisma();
    prisma.workerBuildJob.findUnique.mockResolvedValue({ startedAt: new Date(Date.now() - 1000) });
    prisma.workerBuildJob.update.mockResolvedValue({});

    await markBuildSucceeded(prisma, "job-1", { foo: "bar" }, 0.92);
    const args = prisma.workerBuildJob.update.mock.calls[0]?.[0];
    expect(args.data.status).toBe("succeeded");
    expect(args.data.resultPayload).toEqual({ foo: "bar" });
    expect(args.data.partialPayload).toBeUndefined();
  });

  it("marks partial keeps partialPayload", async () => {
    const prisma: any = makePrisma();
    prisma.workerBuildJob.update.mockResolvedValue({});

    await markBuildPartial(prisma, "job-1", { half: "done" }, "out of citations", 0.5);
    const args = prisma.workerBuildJob.update.mock.calls[0]?.[0];
    expect(args.data.status).toBe("partial");
    expect(args.data.partialPayload).toEqual({ half: "done" });
    expect(args.data.errorMessage).toBe("out of citations");
  });

  it("retries when attempts remain and schedules with exponential backoff", async () => {
    const prisma: any = makePrisma();
    prisma.workerBuildJob.findUnique.mockResolvedValue({
      attempt: 1,
      maxAttempts: 3,
    });
    prisma.workerBuildJob.update.mockResolvedValue({});

    const outcome = await markBuildFailedOrRetry(prisma, "job-1", "transient");
    expect(outcome.status).toBe("retrying");
    expect(outcome.nextRunAt).toBeInstanceOf(Date);
    const args = prisma.workerBuildJob.update.mock.calls[0]?.[0];
    expect(args.data.status).toBe("retrying");
    const delayMs = outcome.nextRunAt!.getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(10_000);
  });

  it("fails terminally when retries are exhausted", async () => {
    const prisma: any = makePrisma();
    prisma.workerBuildJob.findUnique.mockResolvedValue({
      attempt: 5,
      maxAttempts: 5,
    });
    prisma.workerBuildJob.update.mockResolvedValue({});

    const outcome = await markBuildFailedOrRetry(prisma, "job-1", "permanent");
    expect(outcome.status).toBe("failed");
    expect(outcome.nextRunAt).toBeNull();
  });

  it("throws when job is missing", async () => {
    const prisma: any = makePrisma();
    prisma.workerBuildJob.findUnique.mockResolvedValue(null);
    await expect(markBuildFailedOrRetry(prisma, "missing", "err")).rejects.toThrow();
  });
});
