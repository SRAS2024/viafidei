/**
 * Independent verifiers (spec §8) outside the Next runtime: a surface that
 * could not be INSPECTED (live sitemap unreachable, public route unreachable)
 * still fails closed in production, but is marked `inconclusive` and files no
 * repair plan — a "refresh" cannot fix a transport failure and only marched
 * plans to ABANDONED. A surface that WAS inspected and lacks the item still
 * files the plan.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "plan-1" })),
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

const cacheState = vi.hoisted(() => ({ reachable: true, fresh: true, reason: "fresh" }));
vi.mock("@/lib/admin-worker/cache-freshness", () => ({
  computeContentChecksum: () => "ck-1",
  fetchPublicRouteFreshness: vi.fn(async () => ({
    reachable: cacheState.reachable,
    fresh: cacheState.fresh,
    reason: cacheState.reason,
  })),
}));

vi.mock("@/lib/config", () => ({ appConfig: { canonicalUrl: "https://viafidei.app" } }));
vi.mock("@/lib/admin-worker/public-routes", () => ({
  publicRouteFor: () => ({ slugPath: "/prayers/our-father" }),
}));
vi.mock("@/lib/data/published", () => ({
  searchPublished: vi.fn(async () => [{ slug: "our-father" }]),
}));

import { filePlan } from "@/lib/admin-worker/repair-plans";
import {
  runIndependentVerifiers,
  verifyCacheFreshness,
  verifySitemap,
} from "@/lib/admin-worker/search-sitemap-cache-verifiers";

const EXPECTED = "https://viafidei.app/prayers/our-father";

function prisma() {
  return {
    publishedContent: {
      findFirst: vi.fn(async () => ({
        id: "p1",
        title: "Our Father",
        publishedAt: new Date(),
        payload: { prayerText: "Our Father, who art in heaven. Amen." },
        contentChecksum: "ck-1",
      })),
      count: vi.fn(async () => 1),
    },
    adminWorkerLog: { findFirst: vi.fn(async () => ({ createdAt: new Date() })) },
  } as unknown as Parameters<typeof verifySitemap>[0];
}

let savedEnv: Record<string, string | undefined>;
beforeEach(() => {
  savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_WORKER_DISABLE_LIVE_PROBE: process.env.ADMIN_WORKER_DISABLE_LIVE_PROBE,
  };
  delete process.env.ADMIN_WORKER_DISABLE_LIVE_PROBE;
});
afterEach(() => {
  sitemapState.urls = new Set();
  sitemapState.authoritativeEnumerated = true;
  sitemapState.live = null;
  cacheState.reachable = true;
  cacheState.fresh = true;
  cacheState.reason = "fresh";
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.clearAllMocks();
});

const opts = { contentType: "PRAYER", slug: "our-father", title: "Our Father" };

describe("inconclusive vs missing", () => {
  it("marks an unreachable live sitemap / route as inconclusive (still not ok)", async () => {
    sitemapState.urls = new Set([EXPECTED]);
    sitemapState.live = null;
    const sm = await verifySitemap(prisma(), { ...opts, probeLive: true });
    expect(sm.ok).toBe(false);
    expect(sm.inconclusive).toBe(true);

    cacheState.reachable = false;
    const cf = await verifyCacheFreshness(prisma(), { ...opts, probeLive: true });
    expect(cf.ok).toBe(false);
    expect(cf.inconclusive).toBe(true);
  });

  it("a genuinely missing URL / stale route is NOT inconclusive", async () => {
    sitemapState.urls = new Set([EXPECTED]);
    sitemapState.live = new Set(["https://viafidei.app/other"]);
    const sm = await verifySitemap(prisma(), { ...opts, probeLive: true });
    expect(sm.ok).toBe(false);
    expect(sm.inconclusive).toBeUndefined();

    cacheState.fresh = false;
    cacheState.reason = "stale title served";
    const cf = await verifyCacheFreshness(prisma(), { ...opts, probeLive: true });
    expect(cf.ok).toBe(false);
    expect(cf.inconclusive).toBeUndefined();
  });
});

describe("runIndependentVerifiers files repair plans only for inspected misses", () => {
  it("files nothing when the surfaces could not be inspected", async () => {
    process.env.NODE_ENV = "production";
    sitemapState.urls = new Set([EXPECTED]);
    sitemapState.live = null;
    cacheState.reachable = false;
    const out = await runIndependentVerifiers(prisma(), opts);
    expect(out.allOk).toBe(false);
    expect(out.sitemap.inconclusive).toBe(true);
    expect(out.cache.inconclusive).toBe(true);
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
  });

  it("files SITEMAP_VISIBILITY_FAILED + CACHE_FAILED for real misses", async () => {
    process.env.NODE_ENV = "production";
    sitemapState.urls = new Set([EXPECTED]);
    sitemapState.live = new Set(["https://viafidei.app/other"]);
    cacheState.fresh = false;
    cacheState.reason = "stale";
    await runIndependentVerifiers(prisma(), opts);
    const kinds = vi.mocked(filePlan).mock.calls.map((c) => (c[1] as { kind: string }).kind);
    expect(kinds).toContain("SITEMAP_VISIBILITY_FAILED");
    expect(kinds).toContain("CACHE_FAILED");
  });
});
