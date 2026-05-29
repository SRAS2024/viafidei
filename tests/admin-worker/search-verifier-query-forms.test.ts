/**
 * Spec §7: search verification independently checks 4 query forms:
 *   1. title query        — stored title contains the package title
 *   2. slug query         — exact slug match
 *   3. content-type query — at least one row of this content type exists
 *   4. major keyword query — keywords from the title appear in the payload
 *
 * Each query form must produce its own pass/fail result so the
 * operator can see exactly which search axis is broken.
 *
 * Spec §7 + §9: failures auto-file repair plans so the orchestrator
 * can execute the refresh.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "rp-1" })),
}));

import {
  runIndependentVerifiers,
  verifySearchIndex,
} from "@/lib/admin-worker/search-sitemap-cache-verifiers";
import { filePlan } from "@/lib/admin-worker/repair-plans";

function prismaWith(opts: {
  row?: { id?: string; title?: string; payload?: unknown; publishedAt?: Date | null } | null;
  slugCount?: number;
  contentTypeCount?: number;
  cacheLog?: { createdAt: Date } | null;
}) {
  const counts = {
    slug: opts.slugCount ?? 1,
    contentType: opts.contentTypeCount ?? 1,
  };
  let callIdx = 0;
  return {
    publishedContent: {
      findFirst: vi.fn(async () =>
        opts.row === undefined
          ? {
              id: "p1",
              title: "Our Father",
              payload: { prayerText: "Our Father, who art in heaven. Amen." },
              publishedAt: new Date(),
            }
          : opts.row,
      ),
      count: vi.fn(async () => {
        // First call = slug query, second call = contentType query.
        const v = callIdx === 0 ? counts.slug : counts.contentType;
        callIdx += 1;
        return v;
      }),
    },
    adminWorkerLog: {
      findFirst: vi.fn(async () =>
        opts.cacheLog === undefined ? { createdAt: new Date() } : opts.cacheLog,
      ),
    },
    adminWorkerRepairPlan: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "rp-1" })),
    },
  } as unknown as Parameters<typeof verifySearchIndex>[0];
}

describe("verifySearchIndex returns per-query-form results (spec §7)", () => {
  it("returns ok=true with all 4 queryResults true on healthy data", async () => {
    const out = await verifySearchIndex(prismaWith({}), {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.ok).toBe(true);
    expect(out.queryResults).toEqual({
      title: true,
      slug: true,
      contentType: true,
      keywords: true,
    });
  });

  it("queryResults.slug=false when no row matches the slug", async () => {
    const out = await verifySearchIndex(prismaWith({ slugCount: 0 }), {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.queryResults.slug).toBe(false);
    expect(out.ok).toBe(false);
  });

  it("queryResults.contentType=false when no rows of the content type exist", async () => {
    const out = await verifySearchIndex(prismaWith({ contentTypeCount: 0 }), {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.queryResults.contentType).toBe(false);
    expect(out.ok).toBe(false);
  });

  it("queryResults.keywords=false when the payload is missing major keywords", async () => {
    const out = await verifySearchIndex(
      prismaWith({
        row: {
          id: "p1",
          title: "Our Father",
          payload: {}, // no keywords inside
          publishedAt: new Date(),
        },
      }),
      {
        contentType: "PRAYER",
        slug: "our-father",
        title: "Some Particularly Long Title With Big Words",
        majorKeywords: ["particularly", "specific"],
      },
    );
    expect(out.queryResults.keywords).toBe(false);
  });
});

describe("runIndependentVerifiers auto-files repair plans on failure (spec §7 + §9)", () => {
  it("files SEARCH_VISIBILITY_FAILED + SITEMAP_VISIBILITY_FAILED + CACHE_FAILED when all three fail", async () => {
    vi.mocked(filePlan).mockClear();
    // No row at all → all three verifiers fail.
    const prisma = prismaWith({ row: null, cacheLog: null });
    const out = await runIndependentVerifiers(prisma, {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.allOk).toBe(false);
    // Three plans should have been filed — one per failed verifier.
    expect(vi.mocked(filePlan)).toHaveBeenCalledTimes(3);
    const kinds = vi.mocked(filePlan).mock.calls.map((c) => c[1].kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "SEARCH_VISIBILITY_FAILED",
        "SITEMAP_VISIBILITY_FAILED",
        "CACHE_FAILED",
      ]),
    );
  });

  it("does NOT file plans when all three verifiers pass", async () => {
    vi.mocked(filePlan).mockClear();
    const prisma = prismaWith({});
    await runIndependentVerifiers(prisma, {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
  });
});
