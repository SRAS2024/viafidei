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

    expect(seedCuratedContent).toHaveBeenCalledWith(prisma, {
      limit: 25,
      finalizeGoals: false,
      honorBackoff: true,
    });
    expect(res.published).toBe(25);
    expect(res.exhausted).toBe(false);
    expect(writeAdminWorkerLog).toHaveBeenCalledTimes(1);
  });

  it("uses the default batch size when no limit is given", async () => {
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(seedResult({ alreadyPublished: 206 }));
    await runCuratedIngest(prisma, {});
    expect(seedCuratedContent).toHaveBeenCalledWith(prisma, {
      limit: DEFAULT_CURATED_INGEST_BATCH,
      finalizeGoals: false,
      honorBackoff: true,
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

  it("names every entry that failed this run, with its reason and next attempt", async () => {
    // A skipped entry (invalid payload, a gate refusal) used to vanish into
    // `errors` with no log line, and was re-attempted on every pass.
    const nextAttemptAt = Date.parse("2026-10-31T12:00:00Z");
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(
      seedResult({
        attempted: 3,
        skipped: 1,
        alreadyPublished: 2,
        failures: [
          {
            contentType: "PRAYER",
            slug: "anima-christi",
            reason: "blocked: publish safety: incomplete_prayer",
            attempts: 2,
            nextAttemptAt,
          },
        ],
      }),
    );
    await runCuratedIngest(prisma, { passId: "p4" });
    expect(writeAdminWorkerLog).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(writeAdminWorkerLog).mock.calls[0][1] as {
      severity: string;
      message: string;
      safeMetadata: { failures: unknown[] };
    };
    expect(entry.severity).toBe("WARN");
    expect(entry.message).toContain("PRAYER/anima-christi");
    expect(entry.message).toContain("incomplete_prayer");
    expect(entry.message).toContain("attempt 2");
    expect(entry.message).toContain(new Date(nextAttemptAt).toISOString());
    expect(entry.safeMetadata.failures).toHaveLength(1);
  });

  it("names every failing entry of a run, however many fail together", async () => {
    // Entries that fail together come due together and are walked in corpus
    // order, so naming only the first ten left the same entries past the tenth
    // out of every log line — e.g. after a fingerprint change resets every memo.
    const nextAttemptAt = Date.parse("2026-10-31T12:00:00Z");
    const failures = Array.from({ length: 14 }, (_, i) => ({
      contentType: "NOVENA",
      slug: `novena-${String(i + 1).padStart(2, "0")}`,
      reason: "invalid payload (fails the strict content schema)",
      attempts: 1,
      nextAttemptAt,
    }));
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(
      seedResult({ attempted: 14, skipped: 14, failures }),
    );
    await runCuratedIngest(prisma, { passId: "p6" });

    expect(writeAdminWorkerLog).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(writeAdminWorkerLog).mock.calls[0][1] as {
      message: string;
      safeMetadata: { failures: unknown[]; failedEntries: string[] };
    };
    expect(entry.message).toContain("14 entries did not publish");
    expect(entry.message).toContain("NOVENA/novena-10 (");
    expect(entry.message).not.toContain("NOVENA/novena-11 (");
    expect(entry.message).toContain("and 4 more");
    // Fully described: the first ten. Named: all fourteen.
    expect(entry.safeMetadata.failures).toHaveLength(10);
    expect(entry.safeMetadata.failedEntries).toEqual(
      failures.map((f) => `${f.contentType}/${f.slug}`),
    );
  });

  it("stays quiet while failing entries are only waiting out their backoff", async () => {
    vi.mocked(seedCuratedContent).mockResolvedValueOnce(
      seedResult({ attempted: 3, alreadyPublished: 2, deferred: 1, failures: [] }),
    );
    await runCuratedIngest(prisma, { passId: "p5" });
    expect(writeAdminWorkerLog).not.toHaveBeenCalled();
  });
});
