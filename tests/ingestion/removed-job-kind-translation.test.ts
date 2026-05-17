/**
 * Phase 1 — proves the legacy `source_ingest` job kind is no longer
 * an active execution path. Active code only enqueues factory-stage
 * kinds (source_discovery, source_fetch, content_build,
 * content_validate, content_persist).
 *
 * An in-flight `source_ingest` queue row from a pre-migration deploy
 * is translated by the worker dispatch into a fresh `source_discovery`
 * job and the legacy row completes successfully — so no orphaned
 * rows block the queue after the upgrade.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runJobByKind } from "@/lib/ingestion/queue/dispatch";
import {
  isJobKind,
  isRemovedJobKind,
  JOB_KINDS,
  REMOVED_JOB_KINDS,
  validatePayload,
} from "@/lib/ingestion/queue/job-kinds";
import type { QueueJobRow } from "@/lib/ingestion/queue/queue";

beforeEach(() => {
  resetPrismaMock();
});

function legacyRow(over: Partial<QueueJobRow> = {}): QueueJobRow {
  return {
    id: "queue-legacy-1",
    sourceId: "src1",
    jobId: "job1",
    jobName: "vatican.prayers",
    jobKind: "source_ingest",
    dedupeKey: "legacy:1",
    contentType: "Prayer",
    status: "running",
    priority: 100,
    attempts: 0,
    maxAttempts: 5,
    runAt: new Date(),
    startedAt: new Date(),
    finishedAt: null,
    durationMs: null,
    leaseExpiresAt: new Date(Date.now() + 60_000),
    leasedBy: "worker-test",
    errorMessage: null,
    lastError: null,
    payload: { sourceId: "src1", adapterKey: "vatican.prayers", contentType: "Prayer" },
    triggeredBy: "automatic",
    actorUsername: null,
    sentToReviewAt: null,
    cancelRequestedAt: null,
    cancelReason: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe("source_ingest is removed as an active job kind", () => {
  it("source_ingest is not in JOB_KINDS", () => {
    expect(JOB_KINDS as readonly string[]).not.toContain("source_ingest");
  });

  it("source_ingest is in REMOVED_JOB_KINDS", () => {
    expect(REMOVED_JOB_KINDS as readonly string[]).toContain("source_ingest");
  });

  it("isJobKind('source_ingest') is false", () => {
    expect(isJobKind("source_ingest")).toBe(false);
  });

  it("isRemovedJobKind('source_ingest') is true", () => {
    expect(isRemovedJobKind("source_ingest")).toBe(true);
  });

  it("validatePayload rejects source_ingest with a 'Removed job kind' error", () => {
    const result = validatePayload("source_ingest", {
      sourceId: "src1",
      adapterKey: "x",
      mode: "constant",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Removed job kind/);
    }
  });
});

describe("dispatch translates in-flight source_ingest rows into source_discovery", () => {
  it("an in-flight source_ingest row completes by enqueueing a source_discovery follow-up", async () => {
    // Mock the queue table so the translation enqueue can succeed.
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    let createdJobKind: string | undefined;
    let createdPayload: Record<string, unknown> | undefined;
    prismaMock.ingestionJobQueue.create.mockImplementation(
      async ({
        data,
      }: {
        data: { jobKind: string; payload: Record<string, unknown> };
      }) => {
        createdJobKind = data.jobKind;
        createdPayload = data.payload;
        return {
          id: "queue-new-1",
          sourceId: "src1",
          jobId: "job1",
          jobName: "vatican.prayers",
          jobKind: data.jobKind,
          dedupeKey: "translated:queue-legacy-1",
          contentType: "Prayer",
          status: "pending",
          priority: 100,
          attempts: 0,
          maxAttempts: 5,
          runAt: new Date(),
          startedAt: null,
          finishedAt: null,
          durationMs: null,
          leaseExpiresAt: null,
          leasedBy: null,
          errorMessage: null,
          lastError: null,
          payload: data.payload,
          triggeredBy: "automatic",
          actorUsername: null,
          sentToReviewAt: null,
          cancelRequestedAt: null,
          cancelReason: null,
          canceledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    );
    // Audit + data-management writes are best-effort; mock them out.
    prismaMock.queueAuditLog.create.mockResolvedValue({});
    prismaMock.dataManagementLog.create.mockResolvedValue({});

    const result = await runJobByKind(legacyRow());

    expect(result.ok).toBe(true);
    expect(createdJobKind).toBe("source_discovery");
    expect(createdPayload).toMatchObject({
      sourceId: "src1",
      adapterKey: "vatican.prayers",
      contentType: "Prayer",
      mode: "constant",
    });
  });

  it("manual source_ingest rows are translated with triggeredBy='manual'", async () => {
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    let createdTriggeredBy: string | undefined;
    prismaMock.ingestionJobQueue.create.mockImplementation(
      async ({ data }: { data: { triggeredBy: string } }) => {
        createdTriggeredBy = data.triggeredBy;
        return {
          id: "queue-new-2",
          sourceId: "src1",
          jobId: "job1",
          jobName: "vatican.prayers",
          jobKind: "source_discovery",
          dedupeKey: "translated:queue-legacy-2",
          contentType: "Prayer",
          status: "pending",
          priority: 100,
          attempts: 0,
          maxAttempts: 5,
          runAt: new Date(),
          startedAt: null,
          finishedAt: null,
          durationMs: null,
          leaseExpiresAt: null,
          leasedBy: null,
          errorMessage: null,
          lastError: null,
          payload: {},
          triggeredBy: data.triggeredBy,
          actorUsername: null,
          sentToReviewAt: null,
          cancelRequestedAt: null,
          cancelReason: null,
          canceledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    );
    prismaMock.queueAuditLog.create.mockResolvedValue({});
    prismaMock.dataManagementLog.create.mockResolvedValue({});

    const result = await runJobByKind(legacyRow({ triggeredBy: "manual", id: "queue-legacy-2" }));

    expect(result.ok).toBe(true);
    expect(createdTriggeredBy).toBe("manual");
  });
});
