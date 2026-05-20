/**
 * Factory revalidation acceptance (spec §19, §24).
 *
 * "Every public item triggers proper cache revalidation." We run a
 * complete content_build through the factory orchestrator and
 * confirm the cache revalidation log contains a `package_created`
 * entry with the right tags.
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

beforeEach(() => {
  resetPrismaMock();
  clearCacheRevalidationLog();
  prismaMock.prayer.findFirst.mockResolvedValue(null);
  prismaMock.prayer.create.mockResolvedValue({ id: "p1", slug: "our-father" });
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
  prismaMock.sourceQualityScore.findUnique.mockResolvedValue({
    id: "sq",
    buildSuccessCount: 1,
    buildFailureCount: 0,
    qaPassCount: 1,
    qaFailCount: 0,
    duplicateCount: 0,
    wrongContentCount: 0,
    deletedCount: 0,
    autoPaused: false,
    sourceId: "src",
    contentType: "Prayer",
  });
  prismaMock.sourceQualityScore.update.mockResolvedValue({});
});

describe("Factory revalidates after persistence (spec §19, §24)", () => {
  it("emits a package_created revalidation after persisting a new Prayer", async () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://vatican.va/prayers/our-father",
      sourceHost: "vatican.va",
      sourceTitle: "Our Father",
      rawBody:
        "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come, thy will be done. Amen.",
      sourcePurposes: { canIngestPrayers: true },
    });
    const result = await runContentFactory({
      contentType: "Prayer",
      document: doc,
      sourceId: "src",
      sourceRole: "primary_content_source",
    });
    expect(result.decision).toBe("persisted-created");
    const log = getCacheRevalidationLog();
    expect(log.some((e) => e.reason === "package_created")).toBe(true);
    const entry = log.find((e) => e.reason === "package_created");
    expect(entry?.tags).toContain("content-slug:Prayer:our-father");
    expect(entry?.tags).toContain("tab:prayers");
  });
});
