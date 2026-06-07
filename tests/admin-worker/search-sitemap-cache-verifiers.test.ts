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
  row?: { id?: string; title?: string; publishedAt?: Date | null; payload?: unknown } | null;
  cacheLog?: { createdAt: Date } | null;
}) {
  return {
    publishedContent: {
      findFirst: vi.fn(async () =>
        opts.row === undefined
          ? {
              id: "p1",
              title: "Our Father",
              publishedAt: new Date(),
              payload: { prayerText: "Our Father, who art in heaven. Amen." },
            }
          : opts.row,
      ),
      // Spec §7: search verifier now runs separate count() queries
      // for slug / contentType. Default to 1 so the search-ok path
      // returns true; tests can override with mockResolvedValueOnce.
      count: vi.fn(async () => 1),
      // Sitemap verification inspects the generated output, which is
      // reproduced from the authoritative published rows.
      findMany: vi.fn(async () => [{ contentType: "PRAYER", slug: "our-father" }]),
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
    // Spec §7: reason now lists which of the 4 query forms failed.
    expect(out.reason).toMatch(/Search queries failed.*title/);
    expect(out.queryResults.title).toBe(false);
  });
});

describe("verifySitemap (spec §8)", () => {
  it("ok when the public URL appears in the generated sitemap output", async () => {
    const out = await verifySitemap(prismaWithPublished({}), {
      contentType: "PRAYER",
      slug: "our-father",
    });
    expect(out.ok).toBe(true);
    expect(out.reason).toMatch(/generated sitemap/);
  });

  it("fails (→ repair) when the URL is missing from the generated sitemap", async () => {
    // Authoritative enumeration returns a DIFFERENT row, so our URL is
    // genuinely absent from the generated output.
    const prisma = prismaWithPublished({});
    (
      prisma as unknown as { publishedContent: { findMany: ReturnType<typeof vi.fn> } }
    ).publishedContent.findMany = vi.fn(async () => [
      { contentType: "PRAYER", slug: "some-other-prayer" },
    ]);
    const out = await verifySitemap(prisma, { contentType: "PRAYER", slug: "our-father" });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/NOT in the generated sitemap/);
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

  it("fails when the checksum matches but no recent revalidation and route unprobed", async () => {
    const out = await verifyCacheFreshness(prismaWithPublished({ cacheLog: null }), {
      contentType: "PRAYER",
      slug: "our-father",
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/no recent cache revalidation/);
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
