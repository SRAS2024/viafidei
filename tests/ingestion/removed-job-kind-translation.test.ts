/**
 * Proves the legacy `source_ingest`, `content_validate`, and
 * `content_persist` job kinds are no longer active execution paths.
 *
 * The previous runtime translation shim (which rewrote in-flight
 * legacy rows into `source_discovery`) has been deleted now that the
 * queue has been drained. The dispatch path returns a precise error
 * for any remaining legacy row so the operator sees it surface in
 * the queue migration / startup safety check and drains or deletes
 * it manually.
 *
 * Active code only enqueues factory-stage kinds (source_discovery,
 * source_fetch, content_build).
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

function legacyRow(kind: string, over: Partial<QueueJobRow> = {}): QueueJobRow {
  return {
    id: "queue-legacy-1",
    sourceId: "src1",
    jobId: "job1",
    jobName: "vatican.prayers",
    jobKind: kind,
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

describe("legacy job kinds are removed from the active set", () => {
  for (const kind of ["source_ingest", "content_validate", "content_persist"]) {
    it(`${kind} is NOT in JOB_KINDS`, () => {
      expect(JOB_KINDS as readonly string[]).not.toContain(kind);
    });

    it(`${kind} IS in REMOVED_JOB_KINDS`, () => {
      expect(REMOVED_JOB_KINDS as readonly string[]).toContain(kind);
    });

    it(`isJobKind('${kind}') is false`, () => {
      expect(isJobKind(kind)).toBe(false);
    });

    it(`isRemovedJobKind('${kind}') is true`, () => {
      expect(isRemovedJobKind(kind)).toBe(true);
    });

    it(`validatePayload rejects ${kind} with a 'Removed job kind' error`, () => {
      const result = validatePayload(kind, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Removed job kind/);
      }
    });
  }
});

describe("dispatch no longer translates legacy rows — it fails them with a precise diagnostic", () => {
  it("a source_ingest row is rejected (translation shim deleted after queue drain)", async () => {
    // The new behaviour: dispatch must NOT enqueue any follow-up row
    // and must return ok=false with a 'translation shim deleted' message.
    let createCalls = 0;
    prismaMock.ingestionJobQueue.create.mockImplementation(async () => {
      createCalls += 1;
      return {};
    });

    const result = await runJobByKind(legacyRow("source_ingest"));

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/Removed job kind/);
    expect(result.errorMessage).toMatch(/translation shim deleted/);
    expect(createCalls).toBe(0);
  });

  it("a content_validate row is rejected", async () => {
    let createCalls = 0;
    prismaMock.ingestionJobQueue.create.mockImplementation(async () => {
      createCalls += 1;
      return {};
    });
    const result = await runJobByKind(legacyRow("content_validate"));
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/Removed job kind/);
    expect(createCalls).toBe(0);
  });

  it("a content_persist row is rejected", async () => {
    let createCalls = 0;
    prismaMock.ingestionJobQueue.create.mockImplementation(async () => {
      createCalls += 1;
      return {};
    });
    const result = await runJobByKind(legacyRow("content_persist"));
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/Removed job kind/);
    expect(createCalls).toBe(0);
  });
});
