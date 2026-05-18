/**
 * Worker dispatch: a source with `discoveryFeedUrl` set uses the
 * factory-native discovery path INSTEAD of calling runAdapter.
 * Sources without a feed URL fall back to the legacy adapter
 * (preserving production behaviour for adapters that haven't
 * migrated yet).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

// Stub the registry so dispatch's "adapter not registered" guard
// never triggers — these tests focus on the discovery path
// selection, not adapter execution.
const fakeAdapter = {
  key: "test.fake",
  description: "test adapter",
  entityKinds: ["prayer"],
  fetch: vi.fn(async () => ({ items: [] })),
};
vi.mock("@/lib/ingestion/registry", () => ({
  getAdapter: vi.fn(() => fakeAdapter),
}));

const runAdapterMock = vi.fn();
vi.mock("@/lib/ingestion/runner", () => ({
  runAdapter: (...args: unknown[]) => runAdapterMock(...args),
}));

const runFactoryNativeDiscoveryMock = vi.fn();
vi.mock("@/lib/ingestion/queue/factory-native-discovery", () => ({
  runFactoryNativeDiscovery: (...args: unknown[]) => runFactoryNativeDiscoveryMock(...args),
}));

import type { QueueJobRow } from "@/lib/ingestion/queue/queue";
import { runJobByKind } from "@/lib/ingestion/queue/dispatch";

beforeEach(() => {
  resetPrismaMock();
  runAdapterMock.mockReset();
  runFactoryNativeDiscoveryMock.mockReset();
  runAdapterMock.mockResolvedValue({
    recordsSeen: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    recordsReviewRequired: 0,
    errorMessage: null,
  });
  runFactoryNativeDiscoveryMock.mockResolvedValue({
    ok: true,
    feedUrlCount: 5,
    discoveredCount: 5,
    enqueuedCount: 5,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildDiscoveryJob(sourceId: string): QueueJobRow {
  return {
    id: "queue-disc-1",
    sourceId,
    jobId: "j1",
    jobName: "test.fake",
    jobKind: "source_discovery",
    dedupeKey: "disc:1",
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
    payload: { sourceId, adapterKey: "test.fake", mode: "constant" },
    triggeredBy: "automatic",
    actorUsername: null,
    sentToReviewAt: null,
    cancelRequestedAt: null,
    cancelReason: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("dispatch — source_discovery path selection", () => {
  it("uses factory-native discovery when the source has discoveryFeedUrl set", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-factory",
      host: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
      tier: 1,
      canIngestPrayers: true,
    });

    const result = await runJobByKind(buildDiscoveryJob("src-factory"));

    expect(result.ok).toBe(true);
    expect(runFactoryNativeDiscoveryMock).toHaveBeenCalledTimes(1);
    const args = runFactoryNativeDiscoveryMock.mock.calls[0]![0] as {
      sourceId: string;
      sourceHost: string;
      discoveryFeedUrl: string;
    };
    expect(args.sourceId).toBe("src-factory");
    expect(args.sourceHost).toBe("vatican.va");
    expect(args.discoveryFeedUrl).toBe("https://vatican.va/sitemap.xml");
    // The legacy runAdapter MUST NOT be called when the factory-
    // native path is available.
    expect(runAdapterMock).not.toHaveBeenCalled();
  });

  it("falls back to runAdapter when discoveryFeedUrl is null", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-legacy",
      host: "legacy.example.org",
      discoveryFeedUrl: null,
      tier: 2,
      canIngestPrayers: true,
    });

    await runJobByKind(buildDiscoveryJob("src-legacy"));

    expect(runFactoryNativeDiscoveryMock).not.toHaveBeenCalled();
    expect(runAdapterMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to runAdapter when there is no source row at all", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(null);

    await runJobByKind(buildDiscoveryJob("src-missing"));

    expect(runFactoryNativeDiscoveryMock).not.toHaveBeenCalled();
    expect(runAdapterMock).toHaveBeenCalledTimes(1);
  });

  it("source_freshness never uses the factory-native discovery path (only source_discovery does)", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-fresh",
      host: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
      tier: 1,
      canIngestPrayers: true,
    });

    const job = buildDiscoveryJob("src-fresh");
    job.jobKind = "source_freshness";

    await runJobByKind(job);

    // Freshness routes through runAdapter — it's the existing
    // cheap HEAD/ETag check. Factory-native discovery is reserved
    // for source_discovery.
    expect(runFactoryNativeDiscoveryMock).not.toHaveBeenCalled();
    expect(runAdapterMock).toHaveBeenCalledTimes(1);
  });
});
