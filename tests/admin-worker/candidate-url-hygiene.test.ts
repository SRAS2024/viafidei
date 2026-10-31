/**
 * Candidate URL hygiene (candidate-url-hygiene.ts).
 *
 * Production symptom: SOURCE_FETCH kept picking URLs such as
 * https://www.vaticannews.va/cdn-cgi/content?id=… ("Fetch failed") — Cloudflare
 * challenge endpoints that every discovery method happily queued, each with a
 * fresh id. Pinned here:
 *   - every junk URL shape is rejected with its typed code, and real content
 *     URLs (every built-in configured URL included) pass untouched;
 *   - tracking parameters and fragments are stripped before the URL becomes
 *     the dedupe key, without re-encoding anything else;
 *   - the choke point `discoverCandidate` writes no row for a junk shape and
 *     stores the canonical URL, and RSS / internal-link discovery keep
 *     working through it;
 *   - the freshness sweep never re-queues a junk shape;
 *   - the queue sweep retires queued junk-shaped rows (typed reason, one log
 *     per shape) and nothing else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/checklist")>()),
  isFetchableHost: (host: string) => !host.endsWith(".invalid"),
  isApprovedAuthorityHost: (host: string) => !host.endsWith(".invalid"),
}));

import type { PrismaClient } from "@prisma/client";

import {
  JUNK_SHAPE_SWEEP_INTERVAL_MS,
  canonicalCandidateUrl,
  resetJunkShapeSweepClock,
  retireJunkShapedCandidates,
  screenCandidateUrl,
} from "@/lib/admin-worker/candidate-url-hygiene";
import { runFreshnessSweep } from "@/lib/admin-worker/change-sensing";
import { listConfiguredUrls } from "@/lib/admin-worker/configured-urls";
import { discoverFromInternalLinks } from "@/lib/admin-worker/internal-link-discovery";
import { discoverFromFeed } from "@/lib/admin-worker/rss-discovery";
import { discoverCandidate } from "@/lib/admin-worker/web-navigator";

describe("screenCandidateUrl — junk shapes", () => {
  it.each([
    ["https://www.vaticannews.va/cdn-cgi/content?id=9pPFi_KmX0aQ", "cloudflare_challenge"],
    ["https://www.vatican.va/cdn-cgi/l/email-protection#a1b2c3", "cloudflare_challenge"],
    ["https://www.usccb.org/prayers?__cf_chl_tk=abc123", "cloudflare_challenge"],
    ["https://www.usccb.org/prayers?__cf_chl_rt_tk=abc123", "cloudflare_challenge"],
    ["https://example.org/page?cf_chl_seq_x=1", "cloudflare_challenge"],
    ["https://parish.example/wp-json/wp/v2/posts", "cms_endpoint"],
    ["https://parish.example/?rest_route=/wp/v2/pages", "cms_endpoint"],
    ["https://parish.example/xmlrpc.php", "cms_endpoint"],
    ["https://parish.example/wp-admin/admin-ajax.php", "cms_endpoint"],
    ["https://parish.example/wp-login.php?action=register", "cms_endpoint"],
    ["https://example.org/login", "account_page"],
    ["https://example.org/user/sign-in?next=/prayers", "account_page"],
    ["https://example.org/my-account/", "account_page"],
    ["https://example.org/sign-up", "account_page"],
    ["https://example.org/register", "account_page"],
    ["https://example.org/lost-password", "account_page"],
    ["https://shop.example.org/cart", "cart_page"],
    ["https://shop.example.org/checkout/", "cart_page"],
    ["https://shop.example.org/rosary-beads?add-to-cart=123", "cart_page"],
    ["https://www.usccb.org/search?keys=rosary", "search_results"],
    ["https://www.catholic.org/search/?q=novena", "search_results"],
    ["https://www.vatican.va/content/vatican/en/search.html", "search_results"],
    ["https://parish.example/?s=rosary", "search_results"],
    ["https://parish.example/en/?s=rosary", "search_results"],
    ["https://parish.example/page/2/?s=rosary", "search_results"],
    ["https://joomla.example/index.php?searchword=mass&option=com_search", "search_results"],
    ["mailto:office@parish.example", "non_http_url"],
    ["tel:+15551234567", "non_http_url"],
    ["javascript:void(0)", "non_http_url"],
    ["ftp://files.example.org/missal.pdf", "non_http_url"],
    ["/relative/path", "unparseable_url"],
  ])("rejects %s as %s", (url, shape) => {
    const verdict = screenCandidateUrl(url);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.shape).toBe(shape);
  });

  it.each([
    "https://www.vatican.va/content/catechism/en/credo/intro.html",
    "https://www.usccb.org/prayers/our-father",
    "https://example.org/research/marian-apparitions",
    "https://example.org/carthusians/rule",
    "https://example.org/accountability-report",
    "https://www.catholic.org/saints/saint.php?saint_id=123",
    "https://www.biblegateway.com/passage/?search=John+3%3A16&version=NABRE",
    "https://parish.example/history/?s=1",
    "https://www.vatican.va/archive/ccc_css/archive/catechism/prayer.htm",
  ])("accepts content URL %s", (url) => {
    expect(screenCandidateUrl(url)).toEqual({ ok: true, url });
  });

  it("passes every built-in configured URL", () => {
    for (const entry of listConfiguredUrls()) {
      expect(screenCandidateUrl(entry.url).ok, entry.url).toBe(true);
    }
  });
});

describe("canonicalCandidateUrl", () => {
  it("strips tracking parameters and the fragment, keeping everything else as given", () => {
    expect(
      canonicalCandidateUrl(
        "https://parish.example/a-prayer/?utm_source=rss&utm_medium=rss&p=12&fbclid=x#comments",
      ),
    ).toBe("https://parish.example/a-prayer/?p=12");
    expect(canonicalCandidateUrl("https://x.example/p?gclid=1&UTM_Campaign=fall")).toBe(
      "https://x.example/p",
    );
    // No re-encoding or re-ordering of the parameters that stay.
    expect(
      canonicalCandidateUrl("https://www.biblegateway.com/passage/?search=John+3:16&version=NABRE"),
    ).toBe("https://www.biblegateway.com/passage/?search=John+3:16&version=NABRE");
  });

  it("reads an XML/HTML-escaped ampersand back as a separator", () => {
    expect(canonicalCandidateUrl("https://x.example/p?id=4&amp;utm_medium=rss&amp;lang=en")).toBe(
      "https://x.example/p?id=4&lang=en",
    );
  });

  it("returns the URL unchanged when there is nothing to strip", () => {
    const url = "https://www.vatican.va/content/x.html?lang=en&a=%2F";
    expect(canonicalCandidateUrl(url)).toBe(url);
  });

  it("the screen hands back the canonical URL", () => {
    expect(
      screenCandidateUrl("https://www.usccb.org/prayers/anima-christi?utm_source=feed"),
    ).toEqual({ ok: true, url: "https://www.usccb.org/prayers/anima-christi" });
  });
});

// ── The choke point, end to end ───────────────────────────────────────────────

interface CandidateRow {
  id: string;
  discoveredUrl: string;
  status: string;
  rejectionReason?: string | null;
  rejectionPattern?: string | null;
}

function candidatePrisma(seed: CandidateRow[] = []) {
  const rows = new Map(seed.map((r) => [r.discoveredUrl, { ...r }]));
  const logs: Array<{ eventName: string; severity: string; safeMetadata?: unknown }> = [];
  const prisma = {
    rows,
    logs,
    candidateSourceUrl: {
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { discoveredUrl: string };
          create: { status?: string };
        }) => {
          const existing = rows.get(where.discoveredUrl);
          if (existing) return { id: existing.id, status: existing.status };
          const row = {
            id: `c${rows.size + 1}`,
            discoveredUrl: where.discoveredUrl,
            status: create.status ?? "DISCOVERED",
          };
          rows.set(where.discoveredUrl, row);
          return { id: row.id, status: row.status };
        },
      ),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where: { status: { in: string[] }; id?: { gt: string } };
          take: number;
        }) =>
          [...rows.values()]
            .filter((r) => where.status.in.includes(r.status))
            .filter((r) => !where.id || r.id > where.id.gt)
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, take)
            .map((r) => ({ id: r.id, discoveredUrl: r.discoveredUrl })),
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: { in: string[] }; status: { in: string[] } };
          data: Partial<CandidateRow>;
        }) => {
          let count = 0;
          for (const r of rows.values()) {
            if (where.id.in.includes(r.id) && where.status.in.includes(r.status)) {
              Object.assign(r, data);
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
    adminWorkerLog: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: { eventName: string; severity: string; safeMetadata?: unknown };
        }) => {
          logs.push(data);
          return {};
        },
      ),
    },
  };
  return prisma;
}

describe("discoverCandidate — the shared choke point", () => {
  it("writes no row for a junk shape", async () => {
    const prisma = candidatePrisma();
    const row = await discoverCandidate(prisma as unknown as PrismaClient, {
      url: "https://www.vaticannews.va/cdn-cgi/content?id=9pPFi_KmX0aQ",
      sourceHost: "www.vaticannews.va",
      discoveryMethod: "INTERNAL_LINK",
    });
    expect(row).toBeNull();
    expect(prisma.candidateSourceUrl.upsert).not.toHaveBeenCalled();
  });

  it("stores the canonical URL, so tracking variants dedupe onto one row", async () => {
    const prisma = candidatePrisma();
    const a = await discoverCandidate(prisma as unknown as PrismaClient, {
      url: "https://www.usccb.org/prayers/anima-christi?utm_source=rss&utm_medium=feed",
      sourceHost: "www.usccb.org",
      discoveryMethod: "RSS",
    });
    const b = await discoverCandidate(prisma as unknown as PrismaClient, {
      url: "https://www.usccb.org/prayers/anima-christi#top",
      sourceHost: "www.usccb.org",
      discoveryMethod: "SITEMAP",
    });
    expect(a?.id).toBe(b?.id);
    expect([...prisma.rows.keys()]).toEqual(["https://www.usccb.org/prayers/anima-christi"]);
  });
});

describe("discovery methods through the choke point", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function serve(body: string) {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "0" },
      text: async () => body,
    })) as unknown as typeof fetch;
  }

  it("RSS discovery still inserts its items, canonical and without junk", async () => {
    serve(`<?xml version="1.0"?>
<rss><channel>
  <item><link>https://www.vaticannews.va/en/pope/news/2026-10/a.html?utm_source=rss&amp;utm_medium=rss</link></item>
  <item><link>https://www.vaticannews.va/en/church/news/2026-10/b.html</link></item>
  <item><link>https://www.vaticannews.va/cdn-cgi/content?id=Zx81</link></item>
</channel></rss>`);
    const prisma = candidatePrisma();
    const out = await discoverFromFeed(
      prisma as unknown as PrismaClient,
      "https://www.vaticannews.va/feed",
    );
    expect(out.fetched).toBe(true);
    expect(out.inserted).toBe(2);
    expect(out.rejected).toBe(1);
    // The XML-escaped `&amp;` is read back as `&`, so the tags strip cleanly.
    expect([...prisma.rows.keys()].sort()).toEqual([
      "https://www.vaticannews.va/en/church/news/2026-10/b.html",
      "https://www.vaticannews.va/en/pope/news/2026-10/a.html",
    ]);
  });

  it("internal-link discovery skips challenge, search and login links", async () => {
    serve(`<html><body>
  <a href="/en/saints/saint-joseph.html">St Joseph</a>
  <a href="/cdn-cgi/l/email-protection#a1b2">email</a>
  <a href="/search?q=rosary">search</a>
  <a href="/login?return=/">log in</a>
  <a href="/en/prayers/angelus.html?utm_campaign=nav">Angelus</a>
</body></html>`);
    const prisma = candidatePrisma();
    const out = await discoverFromInternalLinks(
      prisma as unknown as PrismaClient,
      "https://www.vaticannews.va/en.html",
      { suppressedPrefixes: new Set() },
    );
    expect(out.inserted).toBe(2);
    expect([...prisma.rows.keys()].sort()).toEqual([
      "https://www.vaticannews.va/en/prayers/angelus.html",
      "https://www.vaticannews.va/en/saints/saint-joseph.html",
    ]);
  });
});

describe("runFreshnessSweep", () => {
  it("never re-queues a junk-shaped source", async () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const upserted: string[] = [];
    const prisma = {
      adminWorkerSourceRead: {
        findMany: async () => [
          {
            sourceUrl: "https://www.vaticannews.va/cdn-cgi/content?id=Q1",
            sourceHost: "www.vaticannews.va",
            createdAt: old,
            updatedAt: old,
          },
          {
            sourceUrl: "https://www.vaticannews.va/en/saints.html",
            sourceHost: "www.vaticannews.va",
            createdAt: old,
            updatedAt: old,
          },
        ],
      },
      adminWorkerFetchResult: { findMany: async () => [] },
      adminWorkerMemory: { findUnique: async () => null },
      candidateSourceUrl: {
        upsert: async ({ where }: { where: { discoveredUrl: string } }) => {
          upserted.push(where.discoveredUrl);
          return { id: "c1", status: "FETCHED" };
        },
        update: async () => ({}),
      },
    } as unknown as PrismaClient;

    const out = await runFreshnessSweep(prisma);

    expect(upserted).toEqual(["https://www.vaticannews.va/en/saints.html"]);
    expect(out.requeued).toBe(1);
  });
});

describe("retireJunkShapedCandidates", () => {
  beforeEach(() => resetJunkShapeSweepClock());

  const seed: CandidateRow[] = [
    {
      id: "a1",
      discoveredUrl: "https://www.vaticannews.va/cdn-cgi/content?id=A",
      status: "DISCOVERED",
    },
    {
      id: "a2",
      discoveredUrl: "https://www.vaticannews.va/cdn-cgi/content?id=B",
      status: "PRIORITIZED",
    },
    { id: "a3", discoveredUrl: "https://parish.example/search?q=mass", status: "DISCOVERED" },
    // Already fetched: never touched (nothing in flight or finished is rewritten).
    {
      id: "a4",
      discoveredUrl: "https://www.vaticannews.va/cdn-cgi/content?id=C",
      status: "FETCHED",
    },
    // Prefilter hit that is real content.
    { id: "a5", discoveredUrl: "https://example.org/carthusians/rule", status: "DISCOVERED" },
    { id: "a6", discoveredUrl: "https://www.usccb.org/prayers/our-father", status: "DISCOVERED" },
  ];

  it("retires queued junk-shaped rows with a typed reason and one log per shape", async () => {
    const prisma = candidatePrisma(seed);
    const out = await retireJunkShapedCandidates(prisma as unknown as PrismaClient, {
      passId: "p1",
    });

    expect(out.ran).toBe(true);
    expect(out.retired).toBe(3);
    expect(out.byShape).toEqual({ cloudflare_challenge: 2, search_results: 1 });
    const byId = new Map([...prisma.rows.values()].map((r) => [r.id, r]));
    expect(byId.get("a1")).toMatchObject({
      status: "REJECTED",
      rejectionPattern: "url-shape:cloudflare_challenge",
    });
    expect(byId.get("a1")?.rejectionReason).toMatch(/^url shape cloudflare_challenge: /);
    expect(byId.get("a3")?.rejectionPattern).toBe("url-shape:search_results");
    expect(byId.get("a4")?.status).toBe("FETCHED");
    expect(byId.get("a5")?.status).toBe("DISCOVERED");
    expect(byId.get("a6")?.status).toBe("DISCOVERED");
    expect(prisma.logs.map((l) => l.eventName)).toEqual([
      "fetch_queue_shape_retired",
      "fetch_queue_shape_retired",
    ]);
    expect(prisma.logs.every((l) => l.severity === "WARN")).toBe(true);
  });

  it("is throttled, writes nothing when the queue is clean, and can be forced", async () => {
    const prisma = candidatePrisma(seed);
    const now = Date.now();
    await retireJunkShapedCandidates(prisma as unknown as PrismaClient, { nowMs: now });
    const again = await retireJunkShapedCandidates(prisma as unknown as PrismaClient, {
      nowMs: now + 60_000,
    });
    expect(again.ran).toBe(false);

    const later = await retireJunkShapedCandidates(prisma as unknown as PrismaClient, {
      nowMs: now + JUNK_SHAPE_SWEEP_INTERVAL_MS + 1,
    });
    expect(later).toMatchObject({ ran: true, retired: 0 });
    expect(prisma.logs).toHaveLength(2); // only the first sweep logged

    const forced = await retireJunkShapedCandidates(prisma as unknown as PrismaClient, {
      nowMs: now + JUNK_SHAPE_SWEEP_INTERVAL_MS + 2,
      force: true,
    });
    expect(forced.ran).toBe(true);
  });

  it("is fail-open when the queue cannot be read", async () => {
    const prisma = {
      candidateSourceUrl: {
        findMany: async () => {
          throw new Error("P2024 pool timeout");
        },
        updateMany: vi.fn(),
      },
    };
    const out = await retireJunkShapedCandidates(prisma as unknown as PrismaClient, {
      force: true,
    });
    expect(out).toMatchObject({ ran: true, retired: 0 });
    expect(prisma.candidateSourceUrl.updateMany).not.toHaveBeenCalled();
  });
});
