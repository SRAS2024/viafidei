/**
 * Auto-cleanup enqueue tests. Verifies the queue is fed
 * content_revalidate jobs from every trigger point.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  autoEnqueuePostIngestionCleanup,
  autoEnqueueScheduledCleanup,
  autoEnqueueRenderGateCleanup,
  autoEnqueueContractVersionCleanup,
  autoEnqueueRejectionSpikeCleanup,
} from "@/lib/ingestion/queue/auto-cleanup";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobQueue.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "queue-1",
      ...data,
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("auto-cleanup enqueue helpers", () => {
  it("autoEnqueuePostIngestionCleanup enqueues a content_revalidate with sweepReason=post_ingestion", async () => {
    await autoEnqueuePostIngestionCleanup({
      sourceId: "src-1",
      contentType: "Prayer",
      workerJobId: "job-1",
    });
    expect(prismaMock.ingestionJobQueue.create).toHaveBeenCalled();
    const args = prismaMock.ingestionJobQueue.create.mock.calls[0][0];
    expect(args.data.jobKind).toBe("content_revalidate");
    expect(args.data.contentType).toBe("Prayer");
    const payload = args.data.payload as Record<string, unknown>;
    expect(payload.sweepReason).toBe("post_ingestion");
    expect(payload.workerJobId).toBe("job-1");
  });

  it("autoEnqueueScheduledCleanup uses sweepReason=scheduled", async () => {
    await autoEnqueueScheduledCleanup();
    const args = prismaMock.ingestionJobQueue.create.mock.calls[0][0];
    expect(args.data.jobKind).toBe("content_revalidate");
    const payload = args.data.payload as Record<string, unknown>;
    expect(payload.sweepReason).toBe("scheduled");
  });

  it("autoEnqueueRenderGateCleanup uses sweepReason=render_gate and carries the slug", async () => {
    await autoEnqueueRenderGateCleanup({ contentType: "Saint", slug: "missing-saint" });
    const args = prismaMock.ingestionJobQueue.create.mock.calls[0][0];
    const payload = args.data.payload as Record<string, unknown>;
    expect(payload.sweepReason).toBe("render_gate");
    expect(payload.slug).toBe("missing-saint");
    expect(payload.contentType).toBe("Saint");
  });

  it("autoEnqueueContractVersionCleanup uses sweepReason=package_version_change", async () => {
    await autoEnqueueContractVersionCleanup({
      previousVersion: "1.0.0",
      newVersion: "1.1.0",
    });
    const args = prismaMock.ingestionJobQueue.create.mock.calls[0][0];
    const payload = args.data.payload as Record<string, unknown>;
    expect(payload.sweepReason).toBe("package_version_change");
    expect(payload.previousVersion).toBe("1.0.0");
    expect(payload.newVersion).toBe("1.1.0");
  });

  it("autoEnqueueRejectionSpikeCleanup uses sweepReason=rejection_spike", async () => {
    await autoEnqueueRejectionSpikeCleanup({ windowMinutes: 30, spikeFactor: 5 });
    const args = prismaMock.ingestionJobQueue.create.mock.calls[0][0];
    const payload = args.data.payload as Record<string, unknown>;
    expect(payload.sweepReason).toBe("rejection_spike");
    expect(payload.windowMinutes).toBe(30);
    expect(payload.spikeFactor).toBe(5);
  });

  it("dedupes within a 5-minute bucket so two calls don't create two rows", async () => {
    // First call should "succeed" (insert).
    await autoEnqueueScheduledCleanup();
    // Second call within the same bucket should use the same dedupeKey.
    await autoEnqueueScheduledCleanup();
    const calls = prismaMock.ingestionJobQueue.create.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0].data.dedupeKey).toBe(calls[1][0].data.dedupeKey);
  });
});
