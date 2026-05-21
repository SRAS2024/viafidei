/**
 * Content growth bootstrap.
 *
 * Pins section 12: when the catalog is starved, the bootstrap
 * enqueues a first wave of `source_discovery` jobs for the priority
 * content types — and never floods an already-busy queue.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/queue", () => ({
  enqueueJob: vi.fn(),
  countQueueByStatus: vi.fn(),
}));

import { runGrowthBootstrap } from "@/lib/ingestion/queue/growth-bootstrap";
import { enqueueJob, countQueueByStatus } from "@/lib/ingestion/queue/queue";

const EMPTY_QUEUE = {
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  retrying: 0,
};

function bootstrapSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    host: "prayers.example.org",
    tier: 1,
    reliabilityScore: 0.9,
    canIngestPrayers: false,
    canIngestSaints: false,
    canIngestSacraments: false,
    canIngestDevotions: false,
    canIngestNovenas: false,
    canIngestRosaryGuides: false,
    canIngestConsecrations: false,
    canIngestLiturgy: false,
    canIngestHistory: false,
    canIngestParishes: false,
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  vi.mocked(enqueueJob).mockReset();
  vi.mocked(countQueueByStatus).mockReset();
});

describe("runGrowthBootstrap", () => {
  it("enqueues a first-wave discovery job for a priority content type", async () => {
    vi.mocked(countQueueByStatus).mockResolvedValue(EMPTY_QUEUE);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      bootstrapSource({ canIngestPrayers: true }),
    ]);
    prismaMock.ingestionJobQueue.count.mockResolvedValue(0);

    const report = await runGrowthBootstrap();

    expect(report.ranBootstrap).toBe(true);
    expect(report.discoveryJobsCreated).toBe(1);
    expect(report.sourcesActivated[0]).toMatchObject({ contentType: "Prayer", sourceId: "s1" });
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobKind: "source_discovery", contentType: "Prayer" }),
    );
  });

  it("does not flood an already-overloaded queue", async () => {
    vi.mocked(countQueueByStatus).mockResolvedValue({ ...EMPTY_QUEUE, pending: 600 });

    const report = await runGrowthBootstrap();

    expect(report.skippedReason).toBe("queue_overloaded");
    expect(report.ranBootstrap).toBe(false);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("skips a content type that already has active discovery flow", async () => {
    vi.mocked(countQueueByStatus).mockResolvedValue(EMPTY_QUEUE);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      bootstrapSource({ canIngestPrayers: true }),
    ]);
    // Every content type already has an active job.
    prismaMock.ingestionJobQueue.count.mockResolvedValue(3);

    const report = await runGrowthBootstrap();

    expect(report.discoveryJobsCreated).toBe(0);
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});
