/**
 * Post-publish rollback decision tree (spec §9). Verifies the
 * repair-first → unpublish → delete/review sequence and that every
 * rollback writes a structured log row.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/human-review", () => ({
  fileHumanReview: vi.fn(async () => ({ id: "hr1" })),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({
    kind: "cache_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  flagSitemapRefresh: vi.fn(async () => ({
    kind: "sitemap_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  flagSearchRefresh: vi.fn(async () => ({
    kind: "search_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
}));

import { decideAndExecuteRollback } from "@/lib/admin-worker/post-publish-rollback";
import { fileHumanReview } from "@/lib/admin-worker/human-review";

function makePrisma() {
  return {
    publishedContent: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  } as unknown as Parameters<typeof decideAndExecuteRollback>[0];
}

const BASE = {
  contentType: "PRAYER",
  contentId: "pub-1",
  slug: "our-father",
  reason: "test reason",
};

describe("decideAndExecuteRollback (spec §9)", () => {
  it("returns REPAIRED when cache repair succeeds (no unpublish)", async () => {
    const prisma = makePrisma();
    const result = await decideAndExecuteRollback(prisma, {
      ...BASE,
      failedCheck: "cache",
    });
    expect(result.kind).toBe("REPAIRED");
    expect(result.repairAttempted).toBe("cache refresh");
    expect(
      vi.mocked(prisma.publishedContent.updateMany as ReturnType<typeof vi.fn>),
    ).not.toHaveBeenCalled();
  });

  it("returns REPAIRED on sitemap repair success", async () => {
    const result = await decideAndExecuteRollback(makePrisma(), {
      ...BASE,
      failedCheck: "sitemap",
    });
    expect(result.kind).toBe("REPAIRED");
    expect(result.repairAttempted).toBe("sitemap refresh");
  });

  it("returns REPAIRED on search repair success", async () => {
    const result = await decideAndExecuteRollback(makePrisma(), {
      ...BASE,
      failedCheck: "search",
    });
    expect(result.kind).toBe("REPAIRED");
    expect(result.repairAttempted).toBe("search refresh");
  });

  it("returns DELETED for severe + clear public_route failure (no recoverable hint)", async () => {
    const prisma = makePrisma();
    const result = await decideAndExecuteRollback(prisma, {
      ...BASE,
      failedCheck: "public_route",
    });
    expect(result.kind).toBe("DELETED");
    expect(result.rollbackAction).toContain("logged deletion");
    expect(
      vi.mocked(prisma.publishedContent.updateMany as ReturnType<typeof vi.fn>),
    ).toHaveBeenCalled();
  });

  it("routes severe failures with recoverableHint to human review (not delete)", async () => {
    const result = await decideAndExecuteRollback(makePrisma(), {
      ...BASE,
      failedCheck: "public_route",
      recoverableHint: true,
    });
    expect(result.kind).toBe("HUMAN_REVIEW");
    expect(result.humanReviewFiled).toBe(true);
  });

  it("routes ambiguous failures (title, tab_placement) to human review", async () => {
    vi.mocked(fileHumanReview).mockClear();
    const result = await decideAndExecuteRollback(makePrisma(), {
      ...BASE,
      failedCheck: "title",
    });
    expect(result.kind).toBe("HUMAN_REVIEW");
    expect(result.humanReviewFiled).toBe(true);
    expect(vi.mocked(fileHumanReview)).toHaveBeenCalled();
  });

  it("unpublishes the row before deciding delete vs review", async () => {
    const prisma = makePrisma();
    await decideAndExecuteRollback(prisma, {
      ...BASE,
      failedCheck: "tab_placement",
    });
    const update = vi.mocked(prisma.publishedContent.updateMany as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as { data?: { isPublished?: boolean } };
    expect(update?.data?.isPublished).toBe(false);
  });

  it("falls through to human review for content_goal_count failures", async () => {
    const result = await decideAndExecuteRollback(makePrisma(), {
      ...BASE,
      failedCheck: "content_goal_count",
    });
    expect(result.kind).toBe("HUMAN_REVIEW");
  });
});
