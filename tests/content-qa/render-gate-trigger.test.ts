/**
 * Render-gate trigger tests. Verifies that a public render-gate
 * failure enqueues a content_revalidate (so the bad row is removed
 * before the next request) and that the helper never throws.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { notifyRenderGateFailure } from "@/lib/content-qa/render-gate-trigger";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobQueue.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "q1", ...data }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("notifyRenderGateFailure", () => {
  it("enqueues a content_revalidate with sweepReason=render_gate", async () => {
    await notifyRenderGateFailure({
      contentType: "Prayer",
      slug: "broken-prayer",
      missingFields: ["prayerType"],
    });
    expect(prismaMock.ingestionJobQueue.create).toHaveBeenCalled();
    const args = prismaMock.ingestionJobQueue.create.mock.calls[0][0];
    const payload = args.data.payload as Record<string, unknown>;
    expect(payload.sweepReason).toBe("render_gate");
    expect(payload.contentType).toBe("Prayer");
    expect(payload.slug).toBe("broken-prayer");
  });

  it("respects enqueueCleanup=false (used by tests/admin previews)", async () => {
    await notifyRenderGateFailure({
      contentType: "Prayer",
      slug: "preview-prayer",
      enqueueCleanup: false,
    });
    expect(prismaMock.ingestionJobQueue.create).not.toHaveBeenCalled();
  });

  it("never throws when the enqueue itself fails", async () => {
    prismaMock.ingestionJobQueue.findFirst.mockRejectedValue(new Error("db down"));
    prismaMock.ingestionJobQueue.create.mockRejectedValue(new Error("db down"));
    await expect(
      notifyRenderGateFailure({ contentType: "Saint", slug: "x" }),
    ).resolves.toBeUndefined();
  });
});
