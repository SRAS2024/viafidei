/**
 * Worker curated-knowledge ingestion (curated-ingest.ts). Proves the worker
 * loop's content-growth helper publishes a bounded batch through the curated
 * seed path, reports exhaustion, and records the activity to the worker log
 * only when it actually did something. The seed path itself (real publish
 * orchestrator gates) is covered by publish-orchestrator + knowledge tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/seed-curated-content", () => ({
  seedCuratedContent: vi.fn(),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { DEFAULT_CURATED_INGEST_BATCH, runCuratedIngest } from "@/lib/admin-worker/curated-ingest";
import { seedCuratedContent } from "@/lib/admin-worker/seed-curated-content";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";

const prisma = {} as never;

function seedResult(over: Partial<Record<string, unknown>> = {}) {
  return {
    attempted: 0,
    published: 0,
    alreadyPublished: 0,
    skipped: 0,
    failed: 0,
    byType: {} as Record<string, number>,
    errors: [] as string[],
    ...over,
  };
}

describe("runCuratedIngest — worker curated-knowledge ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a bounded batch through the seed and logs the activity", async () => {
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(
      seedResult({ attempted: 30, published: 25, alreadyPublished: 5, byType: { DOCTOR: 25 } }),
    );
    const res = await runCuratedIngest(prisma, { passId: "p1", limit: 25 });

    expect(seedCuratedContent).toHaveBeenCalledWith(prisma, { limit: 25 });
    expect(res.published).toBe(25);
    expect(res.exhausted).toBe(false);
    expect(writeAdminWorkerLog).toHaveBeenCalledTimes(1);
  });

  it("uses the default batch size when no limit is given", async () => {
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(seedResult({ alreadyPublished: 206 }));
    await runCuratedIngest(prisma, {});
    expect(seedCuratedContent).toHaveBeenCalledWith(prisma, {
      limit: DEFAULT_CURATED_INGEST_BATCH,
    });
  });

  it("marks exhausted and writes no log when nothing new is published", async () => {
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(seedResult({ alreadyPublished: 206 }));
    const res = await runCuratedIngest(prisma, { passId: "p2" });

    expect(res.exhausted).toBe(true);
    expect(writeAdminWorkerLog).not.toHaveBeenCalled();
  });

  it("logs a warning when items failed even with no successful publishes", async () => {
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(
      seedResult({ attempted: 5, failed: 5, errors: ["boom"] }),
    );
    await runCuratedIngest(prisma, { passId: "p3" });
    expect(writeAdminWorkerLog).toHaveBeenCalledTimes(1);
  });
});
