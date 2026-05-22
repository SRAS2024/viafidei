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

  it("requestedContentType does NOT bypass a router rejection (spec #8)", async () => {
    // The page is an /articles/ URL — router rejects every type.
    // Asking for Prayer specifically must not override that.
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-articles",
      sourceUrl: "https://example.com/articles/prayer-tips",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: FULLY_APPROVED_SOURCE,
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
      routerSignals: {
        title: "Prayer Tips Article",
        headings: [],
        metadata: {},
      },
    });

    expect(result.enqueuedCount).toBe(0);
    const reasons = Object.values(result.skippedReasons).join(" ");
    // Either router_rejected or router_rejected_requested_type satisfies
    // the policy: the requested type was not allowed to override.
    expect(reasons).toMatch(/router/);
  });

  it("requestedContentType acts as tie-breaker when router neither rejects nor selects", async () => {
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-ambiguous",
      sourceUrl: "https://example.com/page-1",
      sourceHost: "example.com",
      contentChecksum: "ck",
      // Source only supports Prayer (single purpose), so router has no
      // ambiguity to resolve.
      source: { ...FULLY_APPROVED_SOURCE, canIngestSaints: false },
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
      routerSignals: {
        title: "Some Generic Page",
        headings: [{ level: 1, text: "Some Generic Page" }],
        metadata: {},
      },
    });

    // No hard negative → request can act as tie-breaker for the only
    // supported type.
    expect(result.enqueuedCount).toBe(1);
  });
});

describe("build-enqueue role gate (spec #4/#15)", () => {
  it("refuses to enqueue when the source role is validation_source", async () => {
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-1",
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: { ...FULLY_APPROVED_SOURCE, role: "validation_source" },
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
    });
    expect(result.enqueuedCount).toBe(0);
    expect(result.skippedReasons.source_role_not_primary).toBeTruthy();
  });

  it("refuses to enqueue when the source role is enrichment_source", async () => {
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-1",
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: { ...FULLY_APPROVED_SOURCE, role: "enrichment_source" },
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
    });
    expect(result.enqueuedCount).toBe(0);
  });

  it("refuses to enqueue when the source role is discovery_only_source", async () => {
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-1",
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: { ...FULLY_APPROVED_SOURCE, role: "discovery_only_source" },
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
    });
    expect(result.enqueuedCount).toBe(0);
  });

  it("enqueues normally when the source role is primary_content_source", async () => {
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-1",
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: { ...FULLY_APPROVED_SOURCE, role: "primary_content_source" },
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
    });
    expect(result.enqueuedCount).toBeGreaterThan(0);
  });

  it("enqueues when role is omitted (test fixture compat)", async () => {
    // Bypass the role gate when role is not set — used by synthetic
    // sources and old test fixtures. The role check kicks in only when
    // the field is set to a non-primary value.
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-1",
      sourceUrl: "https://example.com/prayers/our-father",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: FULLY_APPROVED_SOURCE,
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
    });
    expect(result.enqueuedCount).toBeGreaterThan(0);
  });
});

describe("build-enqueue force rebuild (spec #11)", () => {
  it("skips a previously-failed build at the current builder version when not forced", async () => {
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue({
      buildStatus: "build_failed_missing_required_fields",
      builderVersion: "1.0.0",
    });
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-failed",
      sourceUrl: "https://example.com/prayers/page",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: FULLY_APPROVED_SOURCE,
      requestedContentType: "Prayer",
      triggeredBy: "automatic",
    });
    expect(result.enqueuedCount).toBe(0);
    expect(Object.values(result.skippedReasons).join(" ")).toMatch(
      /previous_build_failed_at_current_builder_version/,
    );
  });

  it("admin force rebuild retries a previously-failed build at the current builder version", async () => {
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue({
      buildStatus: "build_failed_missing_required_fields",
      builderVersion: "1.0.0",
    });
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-failed",
      sourceUrl: "https://example.com/prayers/page",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: FULLY_APPROVED_SOURCE,
      requestedContentType: "Prayer",
      triggeredBy: "admin",
      forceRebuild: true,
    });
    expect(result.enqueuedCount).toBe(1);
  });

  it("admin triggeredBy without forceRebuild still retries a previous failure (admin intent is explicit)", async () => {
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue({
      buildStatus: "build_failed_missing_required_fields",
      builderVersion: "1.0.0",
    });
    const result = await enqueueContentBuildsForSourceDocument({
      sourceDocumentId: "doc-failed",
      sourceUrl: "https://example.com/prayers/page",
      sourceHost: "example.com",
      contentChecksum: "ck",
      source: FULLY_APPROVED_SOURCE,
      requestedContentType: "Prayer",
      triggeredBy: "admin",
    });
    expect(result.enqueuedCount).toBe(1);
  });
});
