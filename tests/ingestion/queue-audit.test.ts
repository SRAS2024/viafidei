import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { recordQueueAudit } from "@/lib/ingestion/queue/audit";

beforeEach(() => {
  resetPrismaMock();
});

describe("queue audit events", () => {
  it("writes one row per call", async () => {
    prismaMock.queueAuditLog.create.mockResolvedValue({});
    await recordQueueAudit({
      jobQueueId: "q1",
      event: "enqueued",
      toStatus: "pending",
      reason: "test",
    });
    expect(prismaMock.queueAuditLog.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.queueAuditLog.create.mock.calls[0][0];
    expect(call.data.event).toBe("enqueued");
    expect(call.data.toStatus).toBe("pending");
  });

  it("swallows DB errors so the surrounding write never throws", async () => {
    prismaMock.queueAuditLog.create.mockRejectedValue(new Error("boom"));
    await expect(
      recordQueueAudit({ jobQueueId: "q1", event: "completed" }),
    ).resolves.toBeUndefined();
  });

  it("supports every documented event without throwing", async () => {
    prismaMock.queueAuditLog.create.mockResolvedValue({});
    const events = [
      "enqueued",
      "leased",
      "completed",
      "retrying",
      "failed",
      "skipped",
      "canceled",
      "cancel_requested",
      "paused",
      "resumed",
      "stale_recovered",
    ] as const;
    for (const e of events) {
      await recordQueueAudit({ jobQueueId: "q1", event: e });
    }
    expect(prismaMock.queueAuditLog.create).toHaveBeenCalledTimes(events.length);
  });
});
