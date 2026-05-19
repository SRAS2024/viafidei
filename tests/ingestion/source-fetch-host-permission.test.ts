/**
 * Spec #2: "Add host level source permission checks before fetch."
 *
 * The source_fetch dispatcher must refuse a fetch when:
 *   - the configured source is paused
 *   - the configured source is configurationStatus="not_configured"
 *   - the URL host does not match the source host (cross-host hijack)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const fetchMock = vi.fn();

import type { QueueJobRow } from "@/lib/ingestion/queue/queue";
import { runJobByKind } from "@/lib/ingestion/queue/dispatch";

beforeEach(() => {
  resetPrismaMock();
  fetchMock.mockReset();
  // @ts-expect-error overriding global fetch for tests
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function fetchJob(over: Partial<QueueJobRow> = {}): QueueJobRow {
  return {
    id: "q1",
    sourceId: "src-1",
    jobId: "job-1",
    jobName: "fetch:example",
    jobKind: "source_fetch",
    dedupeKey: "f:1",
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
    leasedBy: "worker",
    errorMessage: null,
    lastError: null,
    payload: { sourceUrl: "https://example.org/page-1", sourceId: "src-1" },
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

describe("source_fetch host-level permission gate", () => {
  it("refuses when the source is paused", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      host: "example.org",
      pausedAt: new Date(),
      configurationStatus: "factory_native",
    });

    const result = await runJobByKind(fetchJob());

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/paused/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when the source is not_configured", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      host: "example.org",
      pausedAt: null,
      configurationStatus: "not_configured",
    });

    const result = await runJobByKind(fetchJob());

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/not_configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when the URL host does not match the source host", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      host: "vatican.va",
      pausedAt: null,
      configurationStatus: "factory_native",
    });

    const result = await runJobByKind(fetchJob());
    // Source host is vatican.va but URL is example.org → cross-host.

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/cross-host/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when the source row does not exist", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(null);

    const result = await runJobByKind(fetchJob());

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/not found/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
