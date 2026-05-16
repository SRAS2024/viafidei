/**
 * Tests for the "missing worker" alert flow. When the planner
 * enqueues work but `hasHealthyWorker()` returns false, the cron
 * route fires a `no_worker_alive` critical alert.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { hasHealthyWorker } from "@/lib/ingestion/queue/heartbeat";
import { detectStallSignals } from "@/lib/data/queue-health";

beforeEach(() => {
  resetPrismaMock();
});

describe("missing worker alert", () => {
  it("hasHealthyWorker = false when count is zero", async () => {
    prismaMock.workerHeartbeat.count.mockResolvedValue(0);
    expect(await hasHealthyWorker()).toBe(false);
  });

  it("hasHealthyWorker = true when at least one heartbeat is fresh", async () => {
    prismaMock.workerHeartbeat.count.mockResolvedValue(1);
    expect(await hasHealthyWorker()).toBe(true);
  });

  it("detectStallSignals reports jobsEnqueuedButNotProcessed when pending>0 and !healthy", async () => {
    const r = await detectStallSignals({
      contentTypesBelowTarget: ["prayers"],
      pendingCount: 12,
      workerHealthy: false,
      completionsLastHourCount: 0,
      contentGrowthLastHour: 0,
    });
    expect(r.jobsEnqueuedButNotProcessed).toBe(true);
  });
});
