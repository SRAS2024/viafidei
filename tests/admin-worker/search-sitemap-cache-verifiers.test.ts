/**
 * Direct search/sitemap/cache verifiers (spec §8). Confirms each
 * verifier returns ok/fail independently of post-publish probe.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import {
  runIndependentVerifiers,
  verifyCacheFreshness,
  verifySearchIndex,
  verifySitemap,
} from "@/lib/admin-worker/search-sitemap-cache-verifiers";

function prismaWithPublished(opts: {
  row?: { id?: string; title?: string; publishedAt?: Date | null } | null;
  cacheLog?: { createdAt: Date } | null;
}) {
  return {
    publishedContent: {
      findFirst: vi.fn(async () =>
        opts.row === undefined
          ? { id: "p1", title: "Our Father", publishedAt: new Date() }
          : opts.row,
      ),
    },
    adminWorkerLog: {
      findFirst: vi.fn(async () =>
        opts.cacheLog === undefined ? { createdAt: new Date() } : opts.cacheLog,
      ),
    },
  } as unknown as Parameters<typeof verifySearchIndex>[0];
}

describe("verifySearchIndex (spec §8)", () => {
  it("ok when the published row exists and title matches", async () => {
    const out = await verifySearchIndex(prismaWithPublished({}), {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.ok).toBe(true);
  });

  it("fails when there is no PublishedContent row", async () => {
    const out = await verifySearchIndex(prismaWithPublished({ row: null }), {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("No PublishedContent");
  });

  it("fails when the stored title diverges from the package title", async () => {
    const out = await verifySearchIndex(
      prismaWithPublished({
        row: { id: "p1", title: "Totally Different", publishedAt: new Date() },
      }),
      { contentType: "PRAYER", slug: "our-father", title: "Our Father" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("diverges");
  });
});

describe("verifySitemap (spec §8)", () => {
  it("ok when the row exists with publishedAt and slug is URL-safe", async () => {
    const out = await verifySitemap(prismaWithPublished({}), {
      contentType: "PRAYER",
      slug: "our-father",
    });
    expect(out.ok).toBe(true);
  });

  it("fails when slug is not URL-safe", async () => {
    const out = await verifySitemap(prismaWithPublished({}), {
      contentType: "PRAYER",
      slug: "Our Father!",
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("URL-safe");
  });

  it("fails when publishedAt is null", async () => {
    const out = await verifySitemap(
      prismaWithPublished({ row: { id: "p1", title: "Our Father", publishedAt: null } }),
      { contentType: "PRAYER", slug: "our-father" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/publishedAt/);
  });
});

describe("verifyCacheFreshness (spec §8)", () => {
  it("ok when a cache_refresh_flagged log row exists in the last 24h", async () => {
    const out = await verifyCacheFreshness(prismaWithPublished({}), {
      contentType: "PRAYER",
      slug: "our-father",
    });
    expect(out.ok).toBe(true);
  });

  it("fails when no recent cache refresh log row exists", async () => {
    const out = await verifyCacheFreshness(prismaWithPublished({ cacheLog: null }), {
      contentType: "PRAYER",
      slug: "our-father",
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("No cache_refresh_flagged");
  });
});

describe("runIndependentVerifiers (spec §8)", () => {
  it("allOk=true when search, sitemap, and cache all pass", async () => {
    const out = await runIndependentVerifiers(prismaWithPublished({}), {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.allOk).toBe(true);
  });

  it("allOk=false when any single verifier fails", async () => {
    const out = await runIndependentVerifiers(prismaWithPublished({ cacheLog: null }), {
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
    });
    expect(out.allOk).toBe(false);
    expect(out.cache.ok).toBe(false);
  });
});
