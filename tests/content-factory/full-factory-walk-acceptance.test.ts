/**
 * Full factory walk acceptance (spec §23, §24).
 *
 * Spec rule (§24): "Real production sources contribute actual
 * content" / "Every public item appears on the live site under the
 * correct tab" / "Every public item triggers proper cache
 * revalidation."
 *
 * This test drives a synthetic source document through the entire
 * factory pipeline:
 *   builder → normalize → enrich → cross-source bypass (primary
 *   source) → strict QA → persist → revalidate
 *
 * And confirms in one go:
 *   - the decision is `persisted-created`
 *   - prisma.prayer.create receives `publicRenderReady: true` and
 *     `isThresholdEligible: true`
 *   - the cache revalidation log emits package_created + the right
 *     content-slug + tab tags
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/admin-notifications", () => ({
  reportCriticalFailure: vi.fn(),
  sendThresholdCheckFailedWarning: vi.fn(),
}));

import { runContentFactory, syntheticSourceDocument } from "@/lib/content-factory";
import { clearCacheRevalidationLog, getCacheRevalidationLog } from "@/lib/cache/revalidate";
import { contentSlugTag, tabTag } from "@/lib/cache/tags";

beforeEach(() => {
  resetPrismaMock();
  clearCacheRevalidationLog();
  prismaMock.prayer.findFirst.mockResolvedValue(null);
  prismaMock.prayer.create.mockResolvedValue({ id: "p1", slug: "test-prayer" });
  prismaMock.contentPackageBuildLog.create.mockResolvedValue({ id: "log" });
  prismaMock.sourceQualityScore.upsert.mockResolvedValue({
    id: "sq",
    buildSuccessCount: 1,
    buildFailureCount: 0,
    qaPassCount: 1,
    qaFailCount: 0,
    duplicateCount: 0,
    wrongContentCount: 0,
    deletedCount: 0,
    autoPaused: false,
  });
});

describe("Full factory walk acceptance (spec §23, §24)", () => {
  it("a fresh prayer source flows builder → persist → revalidate without losing strict gate", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/prayers/full-walk-test",
      sourceHost: "vatican.va",
      sourceTitle: "Test Prayer Body",
      rawBody:
        "Heavenly Father, we praise Thee for all the gifts of life. We ask for Thy mercy and protection now and always. Amen.",
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src-acceptance",
      sourceRole: "primary_content_source",
    });

    // 1. Decision: persisted-created
    expect(result.decision).toBe("persisted-created");

    // 2. The public row was written with the strict-gate flags TRUE.
    expect(prismaMock.prayer.create).toHaveBeenCalledTimes(1);
    const createCall = prismaMock.prayer.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.status).toBe("PUBLISHED");
    expect(createCall.data.publicRenderReady).toBe(true);
    expect(createCall.data.isThresholdEligible).toBe(true);

    // 3. Cache revalidation fired with the right tab + slug tags.
    const log = getCacheRevalidationLog();
    expect(log.some((e) => e.reason === "package_created")).toBe(true);
    const entry = log.find((e) => e.reason === "package_created");
    expect(entry?.tags).toContain(tabTag("prayers"));
    // The slug emitted by the build log + revalidate path is the
    // package's normalized slug — at minimum it contains "test"
    // because the source title is "Test Prayer Body".
    expect(entry?.tags.some((t) => t.startsWith(contentSlugTag("Prayer", "")))).toBe(true);
  });

  it("a discovery-only source without evidence fails with validation_evidence_missing", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://wider.example/our-father",
      sourceHost: "wider.example",
      sourceTitle: "Some Prayer",
      rawBody: "Heavenly Father, hear our prayer. Amen.",
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src-weak",
      sourceRole: "discovery_only_source",
      validators: [], // no validators available
      collectedEvidence: [], // no inline evidence
    });
    expect(result.decision).toBe("validation-evidence-missing");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });
});
