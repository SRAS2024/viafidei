/**
 * source_fetch automatically chains into content_build.
 *
 * After source_fetch writes a SourceDocument, the dispatcher must
 * enqueue one content_build job per content type the source is
 * approved for. A second fetch for the same URL whose build has
 * already completed at the current builder version must NOT
 * re-enqueue (build eligibility dedupe).
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
  // @ts-expect-error — overriding global fetch for tests
  global.fetch = fetchMock;
  prismaMock.sourceDocument.upsert.mockResolvedValue({
    id: "doc-1",
    sourceUrl: "https://vatican.va/page-1",
    sourceHost: "vatican.va",
    sourceTier: 1,
    sourceTitle: "Page 1",
    rawBody: "body",
    cleanedBody: "body",
    headingsJson: [],
    paragraphsJson: [],
    listsJson: [],
    tablesJson: [],
    linksJson: [],
    metadataJson: {},
    sourcePurposesJson: {},
    fetchStatus: "ok",
    httpStatus: 200,
    etag: null,
    lastModifiedHeader: null,
    contentChecksum: "checksum-A",
    cleanedChecksum: "checksum-A-cleaned",
    language: null,
    fetchedAt: new Date(),
  });
  prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobQueue.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `q-new-${Math.random()}`,
      ...data,
    }),
  );
  prismaMock.dataManagementLog.create.mockResolvedValue({});
  prismaMock.queueAuditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function fetchJob(): QueueJobRow {
  return {
    id: "queue-fetch-1",
    sourceId: "src-1",
    jobId: null,
    jobName: "source_fetch:vatican.va",
    jobKind: "source_fetch",
    dedupeKey: "source_fetch:https://vatican.va/page-1",
    contentType: null,
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
    payload: { sourceUrl: "https://vatican.va/page-1", sourceId: "src-1" },
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

describe("source_fetch chains into content_build", () => {
  it("enqueues one content_build per allowed content type after a successful fetch", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<html><body><h1>Prayer</h1><p>Our Father…</p></body></html>",
      headers: new Map(),
    });
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      host: "vatican.va",
      tier: 1,
      canIngestPrayers: true,
      canIngestSaints: true,
      canIngestApparitions: false,
      canIngestParishes: false,
      canIngestDevotions: false,
      canIngestNovenas: false,
      canIngestSacraments: false,
      canIngestRosaryGuides: false,
      canIngestConsecrations: false,
      canIngestSpiritualGuides: false,
      canIngestLiturgy: false,
      canIngestHistory: false,
      canProvideScriptureText: false,
    });

    const result = await runJobByKind(fetchJob());

    expect(result.ok).toBe(true);
    // Two builds expected: Prayer and Saint.
    const createdJobs = prismaMock.ingestionJobQueue.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { jobKind: string; contentType?: string } }).data,
    );
    const buildJobs = createdJobs.filter((d: { jobKind: string }) => d.jobKind === "content_build");
    expect(buildJobs).toHaveLength(2);
    const types = buildJobs.map((d: { contentType?: string }) => d.contentType).sort();
    expect(types).toEqual(["Prayer", "Saint"]);
    expect(result.errorMessage).toMatch(/enqueued 2 content_build/);
  });

  it("skips builds for content types already built at the current builder version", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<html><body>page</body></html>",
      headers: new Map(),
    });
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      host: "vatican.va",
      tier: 1,
      canIngestPrayers: true,
      canIngestSaints: false,
      canIngestApparitions: false,
      canIngestParishes: false,
      canIngestDevotions: false,
      canIngestNovenas: false,
      canIngestSacraments: false,
      canIngestRosaryGuides: false,
      canIngestConsecrations: false,
      canIngestSpiritualGuides: false,
      canIngestLiturgy: false,
      canIngestHistory: false,
      canProvideScriptureText: false,
    });
    // Read the actual current builder version so the test stays in
    // sync with the registry.
    const { BUILDER_REGISTRY } = await import("@/lib/content-factory");
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue({
      buildStatus: "built_complete_package",
      builderVersion: BUILDER_REGISTRY.Prayer.builderVersion,
    });

    await runJobByKind(fetchJob());

    const createdJobs = prismaMock.ingestionJobQueue.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { jobKind: string } }).data,
    );
    const buildJobs = createdJobs.filter((d: { jobKind: string }) => d.jobKind === "content_build");
    // Already built at the current builder version → zero new builds.
    expect(buildJobs).toHaveLength(0);
  });

  it("does not enqueue builds when the source has no canIngest* purposes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "x",
      headers: new Map(),
    });
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      host: "vatican.va",
      tier: 1,
      canIngestPrayers: false,
      canIngestSaints: false,
      canIngestApparitions: false,
      canIngestParishes: false,
      canIngestDevotions: false,
      canIngestNovenas: false,
      canIngestSacraments: false,
      canIngestRosaryGuides: false,
      canIngestConsecrations: false,
      canIngestSpiritualGuides: false,
      canIngestLiturgy: false,
      canIngestHistory: false,
      canProvideScriptureText: false,
    });

    const result = await runJobByKind(fetchJob());

    expect(result.ok).toBe(true);
    const createdJobs = prismaMock.ingestionJobQueue.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { jobKind: string } }).data,
    );
    const buildJobs = createdJobs.filter((d: { jobKind: string }) => d.jobKind === "content_build");
    expect(buildJobs).toHaveLength(0);
  });
});
