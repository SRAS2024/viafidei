/**
 * Queue repair.
 *
 * Pins section 10: stale running jobs are recovered, retryable
 * failed jobs are requeued, and permanently-failed jobs (bad payload
 * / removed job kind) are left alone.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/queue", () => ({
  recoverStaleJobs: vi.fn(),
}));

import { runQueueRepair, isPermanentQueueFailure } from "@/lib/ingestion/queue/queue-repair";
import { recoverStaleJobs } from "@/lib/ingestion/queue/queue";

beforeEach(() => {
  resetPrismaMock();
  vi.mocked(recoverStaleJobs).mockReset();
});

describe("isPermanentQueueFailure", () => {
  it("treats bad-payload and removed/unknown job kinds as permanent", () => {
    expect(isPermanentQueueFailure("Invalid payload: missing sourceId")).toBe(true);
    expect(isPermanentQueueFailure("Removed job kind 'source_ingest'")).toBe(true);
    expect(isPermanentQueueFailure("Unknown job kind: bogus")).toBe(true);
  });

  it("treats transient errors and missing reasons as retryable", () => {
    expect(isPermanentQueueFailure("network timeout")).toBe(false);
    expect(isPermanentQueueFailure(null)).toBe(false);
  });
});

describe("runQueueRepair", () => {
  it("recovers stale jobs and requeues retryable failed jobs, leaving permanent ones", async () => {
    vi.mocked(recoverStaleJobs).mockResolvedValue(2);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([
      { id: "f1", lastError: "network timeout" },
      { id: "f2", lastError: "Invalid payload: bad job" },
      { id: "f3", lastError: null },
    ]);
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    const report = await runQueueRepair();

    expect(report.staleRunningJobsRecovered).toBe(2);
    expect(report.permanentlyFailedLeftAlone).toBe(1);
    expect(report.retryableFailedRequeued).toBe(2);
    // Only the two retryable ids are requeued.
    const updateArgs = prismaMock.ingestionJobQueue.updateMany.mock.calls[0][0];
    expect(updateArgs.where.id.in).toEqual(["f1", "f3"]);
    expect(updateArgs.data.status).toBe("pending");
    expect(updateArgs.data.attempts).toBe(0);
  });

  it("does not requeue anything when every failed job is permanently failed", async () => {
    vi.mocked(recoverStaleJobs).mockResolvedValue(0);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([
      { id: "f1", lastError: "Invalid payload" },
    ]);
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    const report = await runQueueRepair();

    expect(report.permanentlyFailedLeftAlone).toBe(1);
    expect(report.retryableFailedRequeued).toBe(0);
    expect(prismaMock.ingestionJobQueue.updateMany).not.toHaveBeenCalled();
  });

  it("archives terminal content rejections instead of requeuing them (spec #25)", async () => {
    vi.mocked(recoverStaleJobs).mockResolvedValue(0);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([
      {
        id: "term1",
        lastError: null,
        errorMessage: "factory decision=qa-deleted",
        sentToReviewAt: null,
      },
      {
        id: "term2",
        lastError: "wrong_content: page is /articles/",
        errorMessage: null,
        sentToReviewAt: null,
      },
      {
        id: "term3",
        // Already reviewed — should NOT be re-archived.
        lastError: null,
        errorMessage: "factory decision=qa-rejected",
        sentToReviewAt: new Date(),
      },
      // A real infra failure — should be requeued.
      { id: "retry1", lastError: "ECONNRESET", errorMessage: null, sentToReviewAt: null },
    ]);
    const updateCalls: Array<{
      where: { id: { in: string[] } };
      data: Record<string, unknown>;
    }> = [];
    prismaMock.ingestionJobQueue.updateMany.mockImplementation(async (args: unknown) => {
      const a = args as { where: { id: { in: string[] } }; data: Record<string, unknown> };
      updateCalls.push(a);
      return { count: a.where.id.in.length };
    });
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    const report = await runQueueRepair();

    expect(report.terminalRejectionsArchived).toBe(2);
    expect(report.retryableFailedRequeued).toBe(1);
    // First call archives terminals (term1 + term2) — sets sentToReviewAt.
    const archiveCall = updateCalls.find(
      (c) => c.data.sentToReviewAt !== undefined && c.data.status === undefined,
    );
    expect(archiveCall?.where.id.in).toEqual(["term1", "term2"]);
    // Second call requeues retryable rows.
    const requeueCall = updateCalls.find((c) => c.data.status === "pending");
    expect(requeueCall?.where.id.in).toEqual(["retry1"]);
  });

  it("does NOT archive terminal rejections when archiveTerminalRejections=false", async () => {
    vi.mocked(recoverStaleJobs).mockResolvedValue(0);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([
      {
        id: "term1",
        lastError: null,
        errorMessage: "factory decision=qa-deleted",
        sentToReviewAt: null,
      },
    ]);
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    const report = await runQueueRepair({ archiveTerminalRejections: false });

    expect(report.terminalRejectionsArchived).toBe(0);
    // The terminal row is treated as retryable when archiving is off.
    expect(report.retryableFailedRequeued).toBe(1);
  });
});
