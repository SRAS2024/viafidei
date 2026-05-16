/**
 * Real-Postgres integration tests for queue leases, stale recovery,
 * retry backoff, and dedupe key uniqueness. Only runs under
 * VITEST_INTEGRATION=1 with a real TEST_DATABASE_URL.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { enqueueJob, failJob, leaseNextJob, recoverStaleJobs } from "@/lib/ingestion/queue/queue";

async function clearQueue(): Promise<void> {
  await prisma.queueAuditLog.deleteMany({});
  await prisma.ingestionJobQueue.deleteMany({});
}

beforeEach(async () => {
  await clearQueue();
});

describe("queue lease — real Postgres concurrency", () => {
  it("two simultaneous leaseNextJob calls do not return the same row", async () => {
    const row = await enqueueJob({
      jobName: "integration-test",
      jobKind: "source_ingest",
      dedupeKey: `it:lease:${Date.now()}`,
      contentType: "Prayer",
      payload: {
        sourceId: "src-it-1",
        adapterKey: "integration-test",
        contentType: "Prayer",
        mode: "constant" as const,
      },
      sourceId: null,
      skipValidation: true,
    });
    expect(row.status).toBe("pending");

    const [a, b] = await Promise.all([
      leaseNextJob({ workerId: "worker-a" }),
      leaseNextJob({ workerId: "worker-b" }),
    ]);
    // Exactly one worker should have leased the row.
    const leased = [a, b].filter((x) => x !== null);
    expect(leased).toHaveLength(1);
    expect(leased[0]?.leasedBy).toMatch(/^worker-[ab]$/);
  });

  it("stale lease recovery returns the job to pending after the grace window", async () => {
    await enqueueJob({
      jobName: "integration-test",
      jobKind: "source_ingest",
      dedupeKey: `it:stale:${Date.now()}`,
      contentType: "Prayer",
      payload: {
        sourceId: "src-it-2",
        adapterKey: "integration-test",
        contentType: "Prayer",
        mode: "constant" as const,
      },
      sourceId: null,
      skipValidation: true,
    });
    const leased = await leaseNextJob({ workerId: "worker-c", leaseDurationMs: 1 });
    expect(leased).not.toBeNull();
    // Force the lease to look expired.
    await prisma.ingestionJobQueue.update({
      where: { id: leased!.id },
      data: { leaseExpiresAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    const recovered = await recoverStaleJobs({ graceMs: 0 });
    expect(recovered).toBeGreaterThanOrEqual(1);
    const after = await prisma.ingestionJobQueue.findUnique({
      where: { id: leased!.id },
    });
    expect(after?.status).toBe("pending");
    expect(after?.leasedBy).toBeNull();
  });

  it("retry backoff applies after a recoverable failure", async () => {
    await enqueueJob({
      jobName: "integration-test",
      jobKind: "source_ingest",
      dedupeKey: `it:retry:${Date.now()}`,
      contentType: "Prayer",
      payload: {
        sourceId: "src-it-3",
        adapterKey: "integration-test",
        contentType: "Prayer",
        mode: "constant" as const,
      },
      sourceId: null,
      maxAttempts: 5,
      skipValidation: true,
    });
    const leased = await leaseNextJob({ workerId: "worker-d" });
    expect(leased).not.toBeNull();
    const outcome = await failJob(leased!.id, "transient upstream 503");
    expect(outcome.status).toBe("retrying");
    expect(outcome.nextRunAt).not.toBeNull();
    expect(outcome.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(outcome.attempts).toBe(1);
  });

  it("dedupeKey unique index prevents two active rows for the same key", async () => {
    const dedupeKey = `it:dedupe:${Date.now()}`;
    await enqueueJob({
      jobName: "integration-test",
      jobKind: "source_ingest",
      dedupeKey,
      contentType: "Prayer",
      payload: {
        sourceId: "src-it-4",
        adapterKey: "integration-test",
        contentType: "Prayer",
        mode: "constant" as const,
      },
      sourceId: null,
      skipValidation: true,
    });
    // Second enqueue with the same dedupeKey should converge on the
    // existing pending row (not create a duplicate).
    await enqueueJob({
      jobName: "integration-test",
      jobKind: "source_ingest",
      dedupeKey,
      contentType: "Prayer",
      priority: 5,
      payload: {
        sourceId: "src-it-4",
        adapterKey: "integration-test",
        contentType: "Prayer",
        mode: "constant" as const,
      },
      sourceId: null,
      skipValidation: true,
    });
    const rows = await prisma.ingestionJobQueue.findMany({
      where: { dedupeKey, status: { in: ["pending", "running", "retrying"] } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].priority).toBe(5);
  });
});
