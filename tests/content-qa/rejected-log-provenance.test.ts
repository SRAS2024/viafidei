/**
 * RejectedContentLog must carry the worker job ID and ingestion batch
 * ID for every row written by the strict QA pipeline. The admin
 * deleted-log page surfaces both fields so the operator can trace any
 * rejection back to the worker that produced it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { recordRejectedContent, recordRejectedContentBatch } from "@/lib/content-qa/rejected-log";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.rejectedContentLog.create.mockResolvedValue({});
  prismaMock.rejectedContentLog.createMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RejectedContentLog carries worker + batch provenance", () => {
  it("recordRejectedContent passes workerJobId and ingestionBatchId through", async () => {
    await recordRejectedContent({
      contentType: "Prayer",
      slug: "x",
      rejectionReason: "test",
      decision: "delete",
      workerJobId: "worker-job-123",
      ingestionBatchId: "batch-456",
    });
    const call = prismaMock.rejectedContentLog.create.mock.calls[0][0];
    expect(call.data.workerJobId).toBe("worker-job-123");
    expect(call.data.ingestionBatchId).toBe("batch-456");
  });

  it("recordRejectedContent defaults workerJobId / ingestionBatchId to null", async () => {
    await recordRejectedContent({
      contentType: "Prayer",
      slug: "y",
      rejectionReason: "test",
      decision: "reject",
    });
    const call = prismaMock.rejectedContentLog.create.mock.calls[0][0];
    expect(call.data.workerJobId).toBeNull();
    expect(call.data.ingestionBatchId).toBeNull();
  });

  it("recordRejectedContentBatch propagates worker + batch ids to every row", async () => {
    await recordRejectedContentBatch([
      {
        contentType: "Saint",
        slug: "a",
        rejectionReason: "wrong",
        decision: "delete",
        workerJobId: "wj-1",
        ingestionBatchId: "bt-1",
      },
      {
        contentType: "Saint",
        slug: "b",
        rejectionReason: "wrong",
        decision: "delete",
        workerJobId: "wj-1",
        ingestionBatchId: "bt-1",
      },
    ]);
    const call = prismaMock.rejectedContentLog.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    for (const row of call.data) {
      expect(row.workerJobId).toBe("wj-1");
      expect(row.ingestionBatchId).toBe("bt-1");
    }
  });
});
