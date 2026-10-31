/**
 * Candidate URL hygiene: the URL SHAPES that can never be a content page, and
 * the tracking parameters that make one page look like many.
 *
 * Measured in production: the fetch queue kept handing SOURCE_FETCH URLs such
 * as `https://www.vaticannews.va/cdn-cgi/content?id=…` — Cloudflare's own
 * challenge endpoints, linked from pages served behind a bot challenge — and
 * each one failed, was retried on the 5 min → 30 min → 2 h ladder, and was
 * replaced by a fresh one (every challenge id is unique). Nothing upstream
 * recognised the shape: the junk filter (`isJunkUrl`) judges what a page is
 * ABOUT (events, donations, bulletins), not whether it is a page at all.
 *
 * `screenCandidateUrl` is that missing check, applied where every discovery
 * method persists a candidate (`discoverCandidate`, see web-navigator.ts —
 * sitemap, RSS, internal links, configured URLs, approved-source search pages,
 * directories, web search, source APIs and the structured seeders all go
 * through it) and where the freshness sweep re-queues a source:
 *   - it rejects, with a typed code, Cloudflare endpoints and challenge-token
 *     URLs, CMS machine endpoints (WordPress REST API, xmlrpc.php, wp-admin,
 *     wp-login.php), sign-in / sign-up / account pages, cart / checkout pages,
 *     site-search result pages, and anything that is not http(s);
 *   - it strips tracking parameters (utm_*, fbclid, gclid, …) and the fragment
 *     BEFORE the URL becomes the dedupe key, so an RSS item tagged
 *     `?utm_source=rss` and the same page linked from the sitemap are one row.
 *
 * `retireJunkShapedCandidates` clears what was queued before this filter
 * existed, with the same mechanism the fetch stage already uses for suppressed
 * URL shapes (DISCOVERED / PRIORITIZED rows → REJECTED with the reason, one
 * `fetch_queue_shape_retired` log per shape).
 *
 * Pure and conservative by design: every rule matches a whole path segment, a
 * file name or a query key, never a substring of a word ("/research/" is not a
 * search page, "/carthusians/" is not a cart), and a URL is only rewritten
 * when a tracking parameter, a fragment or an XML-escaped `&amp;` is present.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

/** Why a candidate URL can never be a content page. Closed set, counted in logs. */
export const JUNK_URL_SHAPES = [
  /** Not parseable as an absolute URL. */
  "unparseable_url",
  /** mailto:, tel:, javascript:, data:, ftp:, … — not a web page. */
  "non_http_url",
  /** Cloudflare's own /cdn-cgi/ endpoints and challenge-token (__cf_chl_*) URLs. */
  "cloudflare_challenge",
  /** CMS machine endpoints: WordPress REST API, xmlrpc.php, wp-admin, wp-login.php. */
  "cms_endpoint",
  /** Sign-in, sign-up, sign-out, account and password pages. */
  "account_page",
  /** Shopping cart, basket and checkout pages. */
  "cart_page",
  /** Site-search result pages. */
  "search_results",
] as const;

export type JunkUrlShape = (typeof JUNK_URL_SHAPES)[number];

export type CandidateUrlVerdict =
  | { ok: true; url: string }
  | { ok: false; shape: JunkUrlShape; detail: string };

/** Query keys that only track a click; never part of a page's identity. */
const TRACKING_KEYS: ReadonlySet<string> = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
]);

/** Path segments of sign-in / sign-up / account / password pages (`account_page`). */
export const ACCOUNT_SEGMENTS: ReadonlySet<string> = new Set([
  "login",
  "log-in",
  "logout",
  "log-out",
  "signin",
  "sign-in",
  "signout",
  "sign-out",
  "signup",
  "sign-up",
  "register",
  "registration",
  "account",
  "accounts",
  "my-account",
  "myaccount",
  "lost-password",
  "lostpassword",
  "forgot-password",
  "reset-password",
  "password-reset",
]);

/** Path segments of cart, basket and checkout pages (`cart_page`). */
export const CART_SEGMENTS: ReadonlySet<string> = new Set([
  "cart",
  "basket",
  "checkout",
  "my-cart",
  "shopping-cart",
]);

/** Path segments of site-search result pages (`search_results`). */
export const SEARCH_SEGMENTS: ReadonlySet<string> = new Set([
  "search",
  "search-results",
  "searchresults",
  "site-search",
  "sitesearch",
]);

/** CMS machine-endpoint file names (`cms_endpoint`). */
export const CMS_FILES: ReadonlySet<string> = new Set([
  "xmlrpc.php",
  "wp-login.php",
  "wp-cron.php",
  "wp-trackback.php",
  "wp-comments-post.php",
]);

/** The decoded, lower-cased key of one `k=v` query pair. */
function queryKey(pair: string): string {
  const raw = pair.split("=")[0] ?? "";
  try {
    return decodeURIComponent(raw.replace(/\+/g, " ")).trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function isTrackingKey(key: string): boolean {
  return key.startsWith("utm_") || TRACKING_KEYS.has(key);
}

/**
 * The URL a candidate should be stored under: the fragment and any tracking
 * parameter removed, everything else byte-for-byte as given (no re-encoding,
 * no parameter re-ordering), so rows written before this existed still match.
 *
 * The one rewrite of a kept character is `&amp;` → `&`: the feed, sitemap and
 * link extractors read raw XML / HTML text, where a query's `&` is written
 * `&amp;`, so `?utm_source=rss&amp;utm_medium=rss` would otherwise reach the
 * queue as a parameter named `amp;utm_medium` that no strip could recognise.
 */
export function canonicalCandidateUrl(raw: string): string {
  const trimmed = raw.trim().replace(/&amp;/gi, "&");
  const hashAt = trimmed.indexOf("#");
  const url = hashAt >= 0 ? trimmed.slice(0, hashAt) : trimmed;
  const queryAt = url.indexOf("?");
  if (queryAt < 0) return url;
  const pairs = url.slice(queryAt + 1).split("&");
  const kept = pairs.filter((pair) => !isTrackingKey(queryKey(pair)));
  if (kept.length === pairs.length) return url;
  const base = url.slice(0, queryAt);
  return kept.length > 0 ? `${base}?${kept.join("&")}` : base;
}

function decodedSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s).toLowerCase();
      } catch {
        return s.toLowerCase();
      }
    });
}

/**
 * Is this URL worth queueing at all? Returns the canonical URL to store, or the
 * typed shape that rules it out. Never throws.
 */
export function screenCandidateUrl(raw: string): CandidateUrlVerdict {
  const url = canonicalCandidateUrl(raw);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, shape: "unparseable_url", detail: "not an absolute URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, shape: "non_http_url", detail: `${parsed.protocol} link` };
  }

  const segments = decodedSegments(parsed.pathname);
  const last = segments[segments.length - 1] ?? "";
  const keys = parsed.search
    ? parsed.search
        .slice(1)
        .split("&")
        .map(queryKey)
        .filter((k) => k.length > 0)
    : [];

  if (segments.includes("cdn-cgi")) {
    return { ok: false, shape: "cloudflare_challenge", detail: "Cloudflare /cdn-cgi/ endpoint" };
  }
  const challengeKey = keys.find((k) => /^_*cf_chl/.test(k));
  if (challengeKey) {
    return {
      ok: false,
      shape: "cloudflare_challenge",
      detail: `Cloudflare challenge token (${challengeKey})`,
    };
  }

  if (segments.includes("wp-json") || keys.includes("rest_route")) {
    return { ok: false, shape: "cms_endpoint", detail: "WordPress REST API" };
  }
  if (segments.includes("wp-admin")) {
    return { ok: false, shape: "cms_endpoint", detail: "WordPress admin" };
  }
  if (CMS_FILES.has(last)) {
    return { ok: false, shape: "cms_endpoint", detail: last };
  }

  const accountSegment = segments.find((s) => ACCOUNT_SEGMENTS.has(s));
  if (accountSegment) {
    return { ok: false, shape: "account_page", detail: `/${accountSegment}` };
  }

  const cartSegment = segments.find((s) => CART_SEGMENTS.has(s));
  if (cartSegment) return { ok: false, shape: "cart_page", detail: `/${cartSegment}` };
  if (keys.includes("add-to-cart") || keys.includes("add_to_cart")) {
    return { ok: false, shape: "cart_page", detail: "add-to-cart link" };
  }

  const searchSegment = segments.find((s) => SEARCH_SEGMENTS.has(s));
  if (searchSegment) return { ok: false, shape: "search_results", detail: `/${searchSegment}` };
  if (/^search\.(php|aspx?|html?|jsp|cfm)$/.test(last)) {
    return { ok: false, shape: "search_results", detail: last };
  }
  // WordPress search is `/?s=term` (optionally under a language prefix or a
  // results page); Joomla's is `searchword=`. A `search=` parameter on an
  // ordinary path is NOT treated as one: Bible passage lookups use it.
  const wordpressSearchPath = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:page\/\d+\/?)?$/i;
  if (
    (keys.includes("s") && wordpressSearchPath.test(parsed.pathname)) ||
    keys.includes("searchword")
  ) {
    return { ok: false, shape: "search_results", detail: "site-search query" };
  }

  return { ok: true, url };
}

// ── Retiring what was queued before the filter existed ─────────────────────

/** Minimum gap between two queue sweeps in one process (they run before a fetch pick). */
export const JUNK_SHAPE_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
/** Queued rows examined per sweep page, and pages per sweep. */
const SWEEP_PAGE_SIZE = 500;
const SWEEP_MAX_PAGES = 10;
/** Example URLs carried per retired shape in the log payload. */
const SWEEP_EXAMPLES = 3;

/**
 * Substrings that every junk shape above contains (non-http URLs are matched
 * separately). Only a cheap SQL prefilter: each row it returns is re-judged by
 * `screenCandidateUrl`, so a rare false positive ("/carthusians/" contains
 * "/cart") is examined and left alone. A new shape needs its substring here,
 * or the queue sweep cannot find the rows queued before it — which is why the
 * path-segment shapes are DERIVED from the very sets `screenCandidateUrl`
 * matches: the hand-kept list missed "/registration" (it does not contain
 * "/register"), so those rows were screened at enqueue but never retired. The
 * fixed paths and query keys are listed by hand.
 */
export const JUNK_SHAPE_PREFILTER: readonly string[] = [
  "/cdn-cgi",
  "cf_chl",
  "/wp-json",
  "rest_route=",
  "/wp-admin",
  ...CMS_FILES,
  ...[...ACCOUNT_SEGMENTS, ...CART_SEGMENTS, ...SEARCH_SEGMENTS].map((segment) => `/${segment}`),
  "add-to-cart",
  "add_to_cart",
  "?s=",
  "&s=",
  "searchword=",
];

let lastSweepAt = 0;

/** Forget the sweep throttle (tests, and a forced re-sweep). */
export function resetJunkShapeSweepClock(): void {
  lastSweepAt = 0;
}

export interface JunkShapeRetirement {
  /** False when the sweep was throttled (or the client cannot run it). */
  ran: boolean;
  examined: number;
  retired: number;
  byShape: Partial<Record<JunkUrlShape, number>>;
}

/**
 * Retire every QUEUED candidate whose URL is a junk shape: DISCOVERED /
 * PRIORITIZED rows become REJECTED with `url shape <code>: …` as the reason and
 * `url-shape:<code>` as the pattern, and one `fetch_queue_shape_retired` WARN
 * is written per shape that retired anything (so a quiet queue writes nothing).
 * Nothing in flight or already fetched is touched. Throttled per process and
 * fail-open: a failure leaves the queue exactly as it was.
 */
export async function retireJunkShapedCandidates(
  prisma: PrismaClient,
  opts: { passId?: string | null; nowMs?: number; force?: boolean } = {},
): Promise<JunkShapeRetirement> {
  const out: JunkShapeRetirement = { ran: false, examined: 0, retired: 0, byShape: {} };
  const now = opts.nowMs ?? Date.now();
  if (!opts.force && now - lastSweepAt < JUNK_SHAPE_SWEEP_INTERVAL_MS) return out;
  if (
    typeof prisma.candidateSourceUrl?.findMany !== "function" ||
    typeof prisma.candidateSourceUrl?.updateMany !== "function"
  ) {
    return out;
  }
  lastSweepAt = now;
  out.ran = true;

  const idsByShape = new Map<JunkUrlShape, string[]>();
  const examples = new Map<JunkUrlShape, string[]>();
  try {
    let afterId: string | null = null;
    for (let page = 0; page < SWEEP_MAX_PAGES; page += 1) {
      const rows: Array<{ id: string; discoveredUrl: string }> =
        await prisma.candidateSourceUrl.findMany({
          where: {
            status: { in: ["DISCOVERED", "PRIORITIZED"] },
            ...(afterId ? { id: { gt: afterId } } : {}),
            OR: [
              ...JUNK_SHAPE_PREFILTER.map((s) => ({
                discoveredUrl: { contains: s, mode: "insensitive" as const },
              })),
              { NOT: { discoveredUrl: { startsWith: "http", mode: "insensitive" as const } } },
            ],
          },
          orderBy: { id: "asc" },
          take: SWEEP_PAGE_SIZE,
          select: { id: true, discoveredUrl: true },
        });
      for (const row of rows) {
        out.examined += 1;
        const verdict = screenCandidateUrl(row.discoveredUrl);
        if (verdict.ok) continue;
        idsByShape.set(verdict.shape, [...(idsByShape.get(verdict.shape) ?? []), row.id]);
        const ex = examples.get(verdict.shape) ?? [];
        if (ex.length < SWEEP_EXAMPLES) examples.set(verdict.shape, [...ex, row.discoveredUrl]);
      }
      if (rows.length < SWEEP_PAGE_SIZE) break;
      afterId = rows[rows.length - 1].id;
    }

    for (const [shape, ids] of idsByShape) {
      const result = await prisma.candidateSourceUrl
        .updateMany({
          where: { id: { in: ids }, status: { in: ["DISCOVERED", "PRIORITIZED"] } },
          data: {
            status: "REJECTED",
            rejectionReason: `url shape ${shape}: can never be a content page — retired from the fetch queue.`,
            rejectionPattern: `url-shape:${shape}`,
          },
        })
        .catch(() => null);
      const count = result?.count ?? 0;
      if (count === 0) continue;
      out.retired += count;
      out.byShape[shape] = count;
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId ?? null,
        category: "SOURCE_READING",
        severity: "WARN",
        eventName: "fetch_queue_shape_retired",
        message: `Retired ${count} queued candidate(s) with the junk URL shape ${shape} — they can never be a content page, so fetching them only burns passes (e.g. ${(examples.get(shape) ?? []).join(", ")}).`,
        safeMetadata: { shape, retired: count, examples: examples.get(shape) ?? [] },
      }).catch(() => undefined);
    }
  } catch {
    // Fail-open: an unreadable queue is swept on a later pass.
  }
  return out;
}
