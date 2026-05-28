/**
 * Spec §8: after repair, post-publish must re-verify the failed check.
 * Only if the re-check passes do we declare REPAIRED — otherwise we
 * fall through to unpublish + decide DELETED vs HUMAN_REVIEW.
 *
 * Spec §10: brain consults real pass rates so chronically failing
 * stages get demoted in ranking.
 *
 * Spec §17: post-publish verifyPublished does live HTTP checks when
 * skipNetwork is false.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/human-review", () => ({
  fileHumanReview: vi.fn(async () => ({ id: "hr1" })),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({ succeeded: true, kind: "cache_failed" })),
  flagSitemapRefresh: vi.fn(async () => ({ succeeded: true, kind: "sitemap_failed" })),
  flagSearchRefresh: vi.fn(async () => ({ succeeded: true, kind: "search_failed" })),
}));

import { decideAndExecuteRollback } from "@/lib/admin-worker/post-publish-rollback";

function makePrisma() {
  return {
    publishedContent: { updateMany: vi.fn(async () => ({ count: 1 })) },
  } as unknown as Parameters<typeof decideAndExecuteRollback>[0];
}

const BASE = {
  contentType: "PRAYER",
  contentId: "pub-1",
  slug: "our-father",
  reason: "test",
};

describe("decideAndExecuteRollback re-verifies after repair (spec §8)", () => {
  it("returns REPAIRED when repair succeeds AND re-check passes", async () => {
    const reverify = vi.fn(async () => true);
    const result = await decideAndExecuteRollback(makePrisma(), {
      ...BASE,
      failedCheck: "cache",
      reverify,
    });
    expect(reverify).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe("REPAIRED");
    expect(result.rollbackAction).toContain("reverify");
  });

  it("falls through to unpublish when repair succeeds but re-check still FAILS", async () => {
    const reverify = vi.fn(async () => false);
    const prisma = makePrisma();
    const result = await decideAndExecuteRollback(prisma, {
      ...BASE,
      failedCheck: "cache",
      reverify,
    });
    expect(reverify).toHaveBeenCalledTimes(1);
    // Cache failure with no recoverableHint is not severe → HUMAN_REVIEW
    expect(result.kind).toBe("HUMAN_REVIEW");
    expect(
      vi.mocked(prisma.publishedContent.updateMany as ReturnType<typeof vi.fn>),
    ).toHaveBeenCalled();
  });

  it("keeps the legacy behaviour when no reverify callback is supplied", async () => {
    const result = await decideAndExecuteRollback(makePrisma(), {
      ...BASE,
      failedCheck: "cache",
    });
    expect(result.kind).toBe("REPAIRED");
  });
});
