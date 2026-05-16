import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { cancelJob, isCancelRequested } from "@/lib/ingestion/queue/queue";

beforeEach(() => {
  resetPrismaMock();
});

describe("queue cancellation", () => {
  it("cancels a pending row immediately", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      status: "pending",
    });
    prismaMock.ingestionJobQueue.update.mockResolvedValue({ id: "q1" });
    const result = await cancelJob("q1", "no longer needed", "admin");
    expect(result.ok).toBe(true);
    expect(result.status).toBe("canceled");
    const updateCall = prismaMock.ingestionJobQueue.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("skipped");
    expect(updateCall.data.canceledAt).toBeInstanceOf(Date);
  });

  it("sets cancel-requested on a running row (cooperative)", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      status: "running",
    });
    prismaMock.ingestionJobQueue.update.mockResolvedValue({ id: "q1" });
    const result = await cancelJob("q1", "abort", "admin");
    expect(result.ok).toBe(true);
    expect(result.status).toBe("cancel_requested");
    const call = prismaMock.ingestionJobQueue.update.mock.calls[0][0];
    expect(call.data.cancelRequestedAt).toBeInstanceOf(Date);
    expect(call.data.cancelReason).toBe("abort");
  });

  it("rejects a completed row", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      status: "completed",
    });
    const result = await cancelJob("q1", "test");
    expect(result.ok).toBe(false);
  });

  it("returns not_found for unknown id", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue(null);
    const result = await cancelJob("missing", "test");
    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_found");
  });

  it("isCancelRequested reads the field", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      cancelRequestedAt: new Date(),
    });
    expect(await isCancelRequested("q1")).toBe(true);
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      cancelRequestedAt: null,
    });
    expect(await isCancelRequested("q1")).toBe(false);
  });
});
