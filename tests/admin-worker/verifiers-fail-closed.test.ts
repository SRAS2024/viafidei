/**
 * Production fail-closed behaviour for the live sitemap + cache verifiers.
 *
 * In production (probeLive === true) the verifiers must FAIL when they cannot
 * actually prove the public surface: the "row qualifies for inclusion"
 * sitemap fallback and the "checksum + recent revalidation log" cache
 * fallback are only allowed in local test / documented dry-run mode.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

const sitemapState = vi.hoisted(() => ({
  urls: new Set<string>(),
  authoritativeEnumerated: true,
  live: null as Set<string> | null,
}));
vi.mock("@/lib/admin-worker/sitemap-inspect", () => ({
  buildSitemapUrlSet: vi.fn(async () => ({
    urls: sitemapState.urls,
    authoritativeEnumerated: sitemapState.authoritativeEnumerated,
  })),
  expectedSitemapUrl: () => "https://viafidei.app/prayers/our-father",
  normalizeUrl: (u: string) => u,
  fetchLiveSitemapUrls: vi.fn(async () => sitemapState.live),
}));

const cacheState = vi.hoisted(() => ({
  reachable: true,
  fresh: true,
  reason: "fresh",
}));
vi.mock("@/lib/admin-worker/cache-freshness", () => ({
  computeContentChecksum: () => "ck-1",
  fetchPublicRouteFreshness: vi.fn(async () => ({
    reachable: cacheState.reachable,
    fresh: cacheState.fresh,
    reason: cacheState.reason,
  })),
}));

vi.mock("@/lib/config", () => ({
  appConfig: { canonicalUrl: "https://viafidei.app" },
}));
vi.mock("@/lib/admin-worker/public-routes", () => ({
  publicRouteFor: () => ({ slugPath: "/prayers/our-father" }),
}));

import {
  verifySitemap,
  verifyCacheFreshness,
} from "@/lib/admin-worker/search-sitemap-cache-verifiers";

const EXPECTED = "https://viafidei.app/prayers/our-father";

function prisma() {
  return {
    publishedContent: {
      findFirst: vi.fn(async () => ({
        id: "p1",
        title: "Our Father",
        publishedAt: new Date(),
        payload: { prayerText: "Amen." },
        contentChecksum: "ck-1",
      })),
    },
    adminWorkerLog: {
      findFirst: vi.fn(async () => ({ createdAt: new Date() })),
    },
  } as unknown as Parameters<typeof verifySitemap>[0];
}

afterEach(() => {
  sitemapState.urls = new Set();
  sitemapState.authoritativeEnumerated = true;
  sitemapState.live = null;
  cacheState.reachable = true;
  cacheState.fresh = true;
  cacheState.reason = "fresh";
  vi.clearAllMocks();
});

describe("sitemap verification fails closed in production", () => {
  const opts = { contentType: "PRAYER", slug: "our-father", base: "https://viafidei.app" };

  it("FAILS when the generated output is not inspectable in production", async () => {
    sitemapState.urls = new Set(); // expected URL not present
    sitemapState.authoritativeEnumerated = false; // cannot inspect
    const out = await verifySitemap(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/not inspectable in production/i);
  });

  it("FAILS when the live /sitemap.xml cannot be probed in production", async () => {
    sitemapState.urls = new Set([EXPECTED]); // generated output has it
    sitemapState.live = null; // but live probe fails
    const out = await verifySitemap(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/could not be probed in production/i);
  });

  it("FAILS when the URL is in the generated output but missing from the live sitemap", async () => {
    sitemapState.urls = new Set([EXPECTED]);
    sitemapState.live = new Set<string>(); // live sitemap missing the URL
    const out = await verifySitemap(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/missing from live/i);
  });

  it("PASSES in production when the URL is in both the generated output and the live sitemap", async () => {
    sitemapState.urls = new Set([EXPECTED]);
    sitemapState.live = new Set([EXPECTED]);
    const out = await verifySitemap(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(true);
  });

  it("allows the 'row qualifies' fallback ONLY in local/dry-run mode (probeLive=false)", async () => {
    sitemapState.urls = new Set();
    sitemapState.authoritativeEnumerated = false;
    const out = await verifySitemap(prisma(), { ...opts, probeLive: false });
    expect(out.ok).toBe(true);
    expect(out.reason).toMatch(/local\/dry-run only/i);
  });
});

describe("cache verification fails closed in production", () => {
  const opts = { contentType: "PRAYER", slug: "our-father", base: "https://viafidei.app" };

  it("FAILS when the public route is not reachable in production", async () => {
    cacheState.reachable = false;
    const out = await verifyCacheFreshness(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/not reachable in production/i);
  });

  it("FAILS when the public route serves stale content in production", async () => {
    cacheState.reachable = true;
    cacheState.fresh = false;
    cacheState.reason = "stale title served";
    const out = await verifyCacheFreshness(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(false);
  });

  it("PASSES in production when the public route serves the latest content", async () => {
    cacheState.reachable = true;
    cacheState.fresh = true;
    const out = await verifyCacheFreshness(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(true);
  });

  it("does NOT use the checksum + revalidation-log fallback in production", async () => {
    // Route unreachable + a recent cache-refresh log present: in local mode
    // this would pass via the fallback, but in production it must fail.
    cacheState.reachable = false;
    const out = await verifyCacheFreshness(prisma(), { ...opts, probeLive: true });
    expect(out.ok).toBe(false);
  });

  it("allows the checksum + revalidation-log fallback ONLY in local/dry-run mode (probeLive=false)", async () => {
    const out = await verifyCacheFreshness(prisma(), { ...opts, probeLive: false });
    expect(out.ok).toBe(true);
    expect(out.reason).toMatch(/local\/dry-run only/i);
  });
});
