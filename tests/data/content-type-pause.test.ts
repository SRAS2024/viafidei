import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  isContentTypePaused,
  pauseContentType,
  resumeContentType,
  __resetContentTypePauseCache,
} from "@/lib/data/content-type-pause";

beforeEach(() => {
  resetPrismaMock();
  __resetContentTypePauseCache();
});

describe("content type pause", () => {
  it("isContentTypePaused returns false when no row exists", async () => {
    prismaMock.contentTypePause.findMany.mockResolvedValue([]);
    const r = await isContentTypePaused("Saint");
    expect(r.paused).toBe(false);
  });

  it("isContentTypePaused returns true when a matching row exists", async () => {
    prismaMock.contentTypePause.findMany.mockResolvedValue([
      {
        id: "p1",
        contentType: "Saint",
        pausedAt: new Date("2026-05-15T00:00:00Z"),
        pausedReason: "Investigating quality",
        actorUsername: "admin",
        updatedAt: new Date(),
      },
    ]);
    // Reset cache state by re-pausing first.
    const r = await isContentTypePaused("Saint");
    expect(r.paused).toBe(true);
    expect(r.reason).toBe("Investigating quality");
  });

  it("pauseContentType upserts the row", async () => {
    prismaMock.contentTypePause.upsert.mockResolvedValue({
      id: "p1",
      contentType: "Saint",
      pausedAt: new Date(),
      pausedReason: "test",
      actorUsername: "admin",
      updatedAt: new Date(),
    });
    await pauseContentType("Saint", "test", "admin");
    expect(prismaMock.contentTypePause.upsert).toHaveBeenCalled();
    const call = prismaMock.contentTypePause.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ contentType: "Saint" });
    expect(call.create.contentType).toBe("Saint");
  });

  it("resumeContentType deletes the row", async () => {
    prismaMock.contentTypePause.deleteMany.mockResolvedValue({ count: 1 });
    await resumeContentType("Saint");
    expect(prismaMock.contentTypePause.deleteMany).toHaveBeenCalledWith({
      where: { contentType: "Saint" },
    });
  });

  it("isContentTypePaused returns false for null contentType", async () => {
    const r = await isContentTypePaused(null);
    expect(r.paused).toBe(false);
  });
});
