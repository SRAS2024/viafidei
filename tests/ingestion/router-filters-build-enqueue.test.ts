/**
 * Regression: the content type router is applied before build_enqueue
 * decides which builders to run.
 *
 * When the SourceDocument carries a livestream / event / bulletin /
 * schedule-style title, the router rejects every allowed content type
 * outright, and `enqueueContentBuildsForSourceDocument` must NOT
 * enqueue any content_build job for that document.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { enqueueContentBuildsForSourceDocument } from "@/lib/ingestion/queue/build-enqueue";

const FULLY_APPROVED_SOURCE = {
  id: "src-1",
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
};

beforeEach(() => {
  resetPrismaMock();
  prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
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

describe("content type router filters build_enqueue", () => {
  it("skips every allowed type when router signals scream livestream", async () => {
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-livestream",
      sourceUrl: "https://example.com/prayers/livestream",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: FULLY_APPROVED_SOURCE,
      requestedContentType: null,
      triggeredBy: "automatic",
      routerSignals: {
        title: "Live Stream: Tonight's Prayer Service",
        headings: [{ level: 1, text: "Live Stream: Tonight's Prayer Service" }],
        metadata: {},
      },
    });

    expect(result.enqueuedCount).toBe(0);
    // Both Prayer + Saint were source-purpose-allowed but the router
    // rejected them on the livestream signal. The skip reason must
    // mention the router.
    const reasons = Object.values(result.skippedReasons).join(" ");
    expect(reasons).toMatch(/router_rejected/);
  });

  it("enqueues normally when router signals are benign", async () => {
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-prayer",
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: FULLY_APPROVED_SOURCE,
      requestedContentType: null,
      triggeredBy: "automatic",
      routerSignals: {
        title: "Our Father",
        headings: [{ level: 1, text: "Our Father" }],
        metadata: {},
      },
    });

    // The page carries a strong positive signal for Prayer (the
    // /prayers/ URL), so the router narrows the build to that type
    // instead of also queueing every other type the source permits.
    expect(result.enqueuedCount).toBeGreaterThan(0);
  });
});
