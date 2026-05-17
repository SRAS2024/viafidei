/**
 * Section 12: "Package contract version changes trigger revalidation."
 * Verifies `autoEnqueueContractVersionCleanup` enqueues a content
 * revalidate carrying the previous and new versions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { autoEnqueueContractVersionCleanup } from "@/lib/ingestion/queue/auto-cleanup";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobQueue.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "q", ...data }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("contract version change triggers revalidation", () => {
  it("enqueues a content_revalidate with sweepReason=package_version_change", async () => {
    await autoEnqueueContractVersionCleanup({
      previousVersion: "1.0.0",
      newVersion: "1.1.0",
    });
    expect(prismaMock.ingestionJobQueue.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.ingestionJobQueue.create.mock.calls[0][0].data;
    expect(data.jobKind).toBe("content_revalidate");
    const payload = data.payload as Record<string, unknown>;
    expect(payload.sweepReason).toBe("package_version_change");
    expect(payload.previousVersion).toBe("1.0.0");
    expect(payload.newVersion).toBe("1.1.0");
  });

  it("supports the initial migration case (previousVersion=null)", async () => {
    await autoEnqueueContractVersionCleanup({
      previousVersion: null,
      newVersion: "1.0.0",
    });
    const data = prismaMock.ingestionJobQueue.create.mock.calls[0][0].data;
    const payload = data.payload as Record<string, unknown>;
    expect(payload.previousVersion).toBeNull();
    expect(payload.newVersion).toBe("1.0.0");
  });
});
