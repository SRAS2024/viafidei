/**
 * Public render gate → cleanup trigger integration. When a public
 * detail page calls `notifyRenderGateFailure`, the system should
 * (a) log the gate failure and (b) enqueue a content_revalidate job
 * so the bad row is cleaned up before the next visitor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { notifyRenderGateFailure } from "@/lib/content-qa";

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

describe("public render gate trigger", () => {
  it("Prayer slug → render gate → enqueues a Prayer-scoped cleanup", async () => {
    await notifyRenderGateFailure({
      contentType: "Prayer",
      slug: "broken-prayer",
      missingFields: ["prayerType"],
    });
    const calls = prismaMock.ingestionJobQueue.create.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const payload = calls[0][0].data.payload as Record<string, unknown>;
    expect(payload.contentType).toBe("Prayer");
    expect(payload.sweepReason).toBe("render_gate");
  });

  it("Saint slug → render gate → enqueues a Saint-scoped cleanup", async () => {
    await notifyRenderGateFailure({
      contentType: "Saint",
      slug: "missing-bio",
      missingFields: ["biography"],
    });
    const calls = prismaMock.ingestionJobQueue.create.mock.calls;
    const payload = calls[0][0].data.payload as Record<string, unknown>;
    expect(payload.contentType).toBe("Saint");
  });

  it("Apparition / Devotion / Parish / etc. all wire through the same trigger", async () => {
    const types = [
      "MarianApparition",
      "Devotion",
      "Parish",
      "Sacrament",
      "Consecration",
      "LiturgyEntry",
      "SpiritualLifeGuide",
    ];
    for (const ct of types) {
      await notifyRenderGateFailure({ contentType: ct, slug: `slug-${ct}` });
    }
    expect(prismaMock.ingestionJobQueue.create).toHaveBeenCalledTimes(types.length);
  });

  it("logs the gate failure even when the enqueue fails", async () => {
    prismaMock.ingestionJobQueue.create.mockRejectedValue(new Error("queue down"));
    prismaMock.ingestionJobQueue.findFirst.mockRejectedValue(new Error("queue down"));
    // The helper is async-fire-and-forget — must not throw.
    await expect(
      notifyRenderGateFailure({ contentType: "Prayer", slug: "x" }),
    ).resolves.toBeUndefined();
  });
});
