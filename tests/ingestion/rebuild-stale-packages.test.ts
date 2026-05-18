/**
 * runRebuildStalePackages — proves the helper enqueues a rebuild
 * only when the most recent build log is from an OLDER builder
 * version than the current registry version.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runRebuildStalePackages } from "@/lib/ingestion/queue/rebuild-stale-packages";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobQueue.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `q-${Math.random()}`,
      ...data,
    }),
  );
  prismaMock.queueAuditLog.create.mockResolvedValue({});
  prismaMock.dataManagementLog.create.mockResolvedValue({});
});

describe("runRebuildStalePackages", () => {
  it("enqueues a rebuild when the most recent build log uses an older builder version", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockImplementation(
      async (args: { where?: { contentType?: string } } = {}) => {
        if (args.where?.contentType === "Prayer") {
          return [
            {
              sourceDocumentId: "doc-1",
              sourceUrl: "https://example.com/p",
              sourceHost: "example.com",
              builderVersion: "0.9.0", // older than the current registry version
            },
          ];
        }
        return [];
      },
    );
    // For the buildEligibility lookup inside enqueueContentBuildsForSourceDocument.
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
    prismaMock.sourceDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      sourceUrl: "https://example.com/p",
      sourceHost: "example.com",
      contentChecksum: "ck",
      sourceId: "src-1",
    });
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
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

    const report = await runRebuildStalePackages({ perTypeLimit: 5 });

    expect(report.rebuildsEnqueued).toBeGreaterThan(0);
    const enqueued = prismaMock.ingestionJobQueue.create.mock.calls
      .map((c: unknown[]) => (c[0] as { data: { jobKind: string; contentType?: string } }).data)
      .filter((d: { jobKind: string }) => d.jobKind === "content_build");
    expect(enqueued.length).toBeGreaterThan(0);
    expect(enqueued.some((d: { contentType?: string }) => d.contentType === "Prayer")).toBe(true);
  });

  it("does NOT enqueue a rebuild when the build log is already at the current version", async () => {
    // Pull the current Prayer builder version dynamically.
    const { BUILDER_REGISTRY } = await import("@/lib/content-factory");
    prismaMock.contentPackageBuildLog.findMany.mockImplementation(
      async (args: { where?: { contentType?: string } } = {}) => {
        if (args.where?.contentType === "Prayer") {
          return [
            {
              sourceDocumentId: "doc-1",
              sourceUrl: "https://example.com/p",
              sourceHost: "example.com",
              builderVersion: BUILDER_REGISTRY.Prayer.builderVersion,
            },
          ];
        }
        return [];
      },
    );
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
    prismaMock.sourceDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      sourceUrl: "https://example.com/p",
      sourceHost: "example.com",
      contentChecksum: "ck",
      sourceId: "src-1",
    });
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
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

    const report = await runRebuildStalePackages({ perTypeLimit: 5 });

    expect(report.skipped).toBeGreaterThan(0);
    const enqueued = prismaMock.ingestionJobQueue.create.mock.calls
      .map((c: unknown[]) => (c[0] as { data: { jobKind: string; contentType?: string } }).data)
      .filter(
        (d: { jobKind: string; contentType?: string }) =>
          d.jobKind === "content_build" && d.contentType === "Prayer",
      );
    expect(enqueued).toHaveLength(0);
  });
});
