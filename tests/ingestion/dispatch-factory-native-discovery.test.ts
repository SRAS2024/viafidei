/**
 * Worker dispatch: source_discovery is factory-native only. The
 * legacy adapter fallback path has been removed, so sources without
 * a configured `discoveryFeedUrl` fail loudly rather than silently
 * running an old adapter.
 *
 * source_freshness is a lightweight HEAD probe (no adapter
 * execution).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const runFactoryNativeDiscoveryMock = vi.fn();
vi.mock("@/lib/ingestion/queue/factory-native-discovery", () => ({
  runFactoryNativeDiscovery: (...args: unknown[]) => runFactoryNativeDiscoveryMock(...args),
}));

const fetchMock = vi.fn();

import type { QueueJobRow } from "@/lib/ingestion/queue/queue";
import { runJobByKind } from "@/lib/ingestion/queue/dispatch";

beforeEach(() => {
  resetPrismaMock();
  runFactoryNativeDiscoveryMock.mockReset();
  runFactoryNativeDiscoveryMock.mockResolvedValue({
    ok: true,
    feedUrlCount: 5,
    discoveredCount: 5,
    enqueuedCount: 5,
  });
  fetchMock.mockReset();
  // Default HEAD response for source_freshness.
  fetchMock.mockResolvedValue({ ok: true, status: 200, headers: new Map() });
  // @ts-expect-error — overriding global fetch for tests
  global.fetch = fetchMock;
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

describe("dispatch — source_discovery is factory-native only", () => {
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
  });

  it("fails loudly when discoveryFeedUrl is null (no legacy fallback)", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-legacy",
      host: "legacy.example.org",
      discoveryFeedUrl: null,
      tier: 2,
      canIngestPrayers: true,
    });

    const result = await runJobByKind(buildDiscoveryJob("src-legacy"));

    expect(runFactoryNativeDiscoveryMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/no discoveryFeedUrl|not_configured/i);
  });

  it("fails when there is no source row at all (no legacy fallback)", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(null);

    const result = await runJobByKind(buildDiscoveryJob("src-missing"));

    expect(runFactoryNativeDiscoveryMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/not found/i);
  });

  it("source_freshness runs a lightweight HEAD probe (never the legacy adapter)", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-fresh",
      host: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
      baseUrl: "https://vatican.va",
      tier: 1,
      canIngestPrayers: true,
    });

    const job = buildDiscoveryJob("src-fresh");
    job.jobKind = "source_freshness";

    const result = await runJobByKind(job);

    // Factory-native discovery only runs for source_discovery, not freshness.
    expect(runFactoryNativeDiscoveryMock).not.toHaveBeenCalled();
    // The HEAD probe is the only network call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0]!;
    expect((fetchCall[1] as { method?: string } | undefined)?.method).toBe("HEAD");
    expect(result.ok).toBe(true);
  });
});
