/**
 * Factory-native source-discovery handler.
 *
 * When an IngestionSource has `discoveryFeedUrl` set, the worker's
 * source_discovery dispatch routes through here INSTEAD of calling
 * `runAdapter`. The flow:
 *
 *   1. Fetch the discovery feed URL (sitemap.xml or RSS-ish XML).
 *   2. Extract every <loc>...</loc> URL.
 *   3. Filter out URLs that are not the same host as the source
 *      (defense in depth — a poisoned sitemap should not redirect
 *      us to an arbitrary external host).
 *   4. Apply a content-type aware URL gate. URLs whose path looks
 *      like /articles/, /news/, /events/, /livestream/, /podcast/,
 *      /donate/, /register/, /tag/, etc. are dropped before fetch
 *      because they can never become a content package. When the
 *      caller hinted at a specific `requestedContentType`, positive
 *      URL rules let matching paths pass even when the source's
 *      sitemap is broad — but hard negatives ALWAYS win.
 *   5. For each URL not already discovered, write a
 *      DiscoveredSourceItem row (carrying `contentType` when known)
 *      AND enqueue a source_fetch job (carrying `contentType` so the
 *      build router can use it as a signal downstream).
 *   6. The source_fetch handler then fetches the URL and writes a
 *      SourceDocument; source_fetch's own follow-up logic chains
 *      a single combined content_build job (build + normalize +
 *      enrich + strict QA + persist in one worker tick).
 *
 * This path runs no adapter logic. It only uses the durable queue,
 * which makes it strictly factory-native per the spec.
 */

import { extractSitemapUrls } from "../sources/discovery";
import { recordDiscoveredItem } from "../../data/discovered-items";
import { logger } from "../../observability/logger";
import { enqueueJob, PRIORITY_NORMAL } from "./queue";
import type { ContentTypeKey } from "../../content-factory";

export type FactoryDiscoveryInput = {
  sourceId: string;
  sourceHost: string;
  discoveryFeedUrl: string;
  workerJobId: string;
  /**
   * Content type the caller (growth bootstrap, discovery expansion,
   * source job repair, admin replay) intends this discovery wave to
   * produce. When set, positive URL rules for the type can rescue
   * matching paths from broad sitemaps; downstream the source_fetch
   * job carries the same hint so the build router uses it as a
   * strong-signal selector. `null` means "no hint" — discovery still
   * filters out hard-negative URLs but does not narrow by type.
   */
  requestedContentType?: ContentTypeKey | null;
  /**
   * Source-config-level deny / allow path filters. When provided,
   * deny patterns are applied as hard negatives ALONGSIDE the global
   * list; allow patterns (when non-empty) require a URL to match at
   * least one allow pattern in addition to passing every other gate.
   * Used by `marian.org` and similar broad-sitemap sources that need
   * curated path scoping.
   */
  denyPaths?: ReadonlyArray<string> | null;
  allowPaths?: ReadonlyArray<string> | null;
  /** Optional cap so a giant sitemap doesn't pile thousands of jobs in one tick. */
  maxUrlsPerRun?: number;
};

export type FactoryDiscoveryResult = {
  ok: boolean;
  errorMessage?: string;
  /** URLs found in the feed AFTER same-host filtering. */
  feedUrlCount: number;
  /** URLs that resulted in a new DiscoveredSourceItem row. */
  discoveredCount: number;
  /** URLs we enqueued a source_fetch job for. */
  enqueuedCount: number;
  /**
   * URLs skipped because the URL itself is an obvious non-content page
   * (article / news / event / livestream / blog / podcast / video /
   * press / register / donate / newsletter / tag / category / author).
   * These can never become a content package, so discovery does not
   * even fetch them.
   */
  skippedNonContentCount: number;
  /**
   * URLs skipped because the caller hinted at a content type and the
   * URL did not match a positive rule for that type. Reported
   * separately so the admin can see why a curated discovery wave
   * fetched fewer URLs than the sitemap listed.
   */
  skippedTypeMismatchCount: number;
};

const DEFAULT_MAX_URLS = 200;

/**
 * Hard-negative URL path shapes. Any URL whose path component matches
 * one of these regex shapes is dropped at discovery time — a
 * /articles/, /news/, /events/, /livestream/, /podcast/, /donate/,
 * /register/, /newsletter/, /press/, /tag/, /category/, /author/,
 * /store/, /shop/, /cart/, /search/, /login/, /account/ URL is never
 * a candidate Catholic content package, even when the source claims
 * it supports the requested content type.
 *
 * Matched on path components only so a legitimate `/prayers/...` or
 * `/saints/...` URL is never affected. The regex anchors on `/`
 * before and `[/?#-]|$` after so partial matches like `/saint-news/`
 * (a legitimate saint URL with "news" in the slug) still pass.
 */
const NON_CONTENT_URL_RE =
  /\/(?:articles?|blog|news|events?|calendar|livestreams?|live-streams?|watch-live|webinar|podcasts?|videos?|press(?:-releases?)?|register|registration|event-registration|register-now|donate|donations?|give-now|gift|newsletters?|subscribe|store|shop|cart|checkout|search|login|sign-in|account|profile|tag|tags|category|categories|author|authors|members?|jobs?|careers?)(?=[/?#-]|$)/i;

/**
 * Positive URL rules per content type. When the caller hints at a
 * specific content type, a URL that matches one of these patterns
 * passes the discovery gate even when the source's sitemap is broad
 * (so curated content URLs are still picked up from a noisy feed).
 *
 * Hard negatives ALWAYS win — a URL like
 * `/articles/devotion-to-mary` is dropped regardless of how strong
 * the positive Devotion signal looks.
 */
const CONTENT_URL_RULES_BY_TYPE: Partial<Record<ContentTypeKey, ReadonlyArray<RegExp>>> = {
  Prayer: [/\/prayers?\b/i, /\/oraciones\b/i, /\/litan(?:y|ies)\b/i, /\/chaplet\b/i],
  Devotion: [/\/devotions?\b/i, /\/devotionals?\b/i, /\/spiritual-devotion\b/i],
  Novena: [/\/novenas?\b/i, /\/nine-day\b/i],
  Rosary: [/\/rosary\b/i, /\/rosaries\b/i, /\/mysteries\b/i],
  Consecration: [/\/consecration\b/i, /\/33-days\b/i, /\/33days\b/i, /\/total-consecration\b/i],
  Saint: [/\/saints?\b/i, /\/saint-of-the-day\b/i, /\/vita\b/i, /\/sancti\b/i],
  MarianApparition: [
    /\/apparitions?\b/i,
    /\/fatima\b/i,
    /\/lourdes\b/i,
    /\/guadalupe\b/i,
  ],
  Liturgy: [/\/liturg(?:y|ies|ical)\b/i, /\/mass\b/i, /\/divine-office\b/i, /\/breviary\b/i],
  Sacrament: [
    /\/sacraments?\b/i,
    /\/baptism\b/i,
    /\/eucharist\b/i,
    /\/confirmation\b/i,
    /\/reconciliation\b/i,
    /\/matrimony\b/i,
    /\/holy-orders\b/i,
    /\/anointing\b/i,
  ],
  History: [/\/history\b/i, /\/councils?\b/i, /\/encyclical\b/i, /\/catechism\b/i],
  Parish: [/\/parish(?:es)?\b/i, /\/church\b/i, /\/directory\b/i],
  SpiritualGuidance: [/\/spiritual-(?:guidance|direction|life)\b/i],
};

/**
 * Returns true when `candidate` belongs to the same hostname as
 * `expectedHost`. Falsy / non-URL inputs return false.
 */
function isSameHost(candidate: string, expectedHost: string): boolean {
  try {
    return new URL(candidate).hostname === expectedHost;
  } catch {
    return false;
  }
}

/**
 * Canonicalize a discovery URL before we record / enqueue it. Strips
 * tracking parameters and fragment, normalizes the host to lower
 * case, and drops a trailing slash on the path so that
 * `https://example.org/x` and `https://example.org/x/` resolve to the
 * same DiscoveredSourceItem dedupe key.
 *
 * Spec #2: "Add canonical URL normalization before saving discovered
 * items. Add duplicate URL filtering at discovery time."
 */
export function canonicalizeDiscoveredUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = "";
    // Strip common tracking parameters.
    const drop = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
    ];
    for (const k of drop) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return input;
  }
}

/**
 * True when `url` matches one of the hard-negative path shapes
 * (articles, news, events, livestream, podcast, donate, register,
 * newsletter, press, etc.). Exposed for testing so the gate can be
 * exercised in isolation.
 */
export function isNonContentUrl(url: string): boolean {
  return NON_CONTENT_URL_RE.test(url);
}

/**
 * True when `url` matches at least one positive rule for the given
 * content type. Returns false when there are no rules for the type
 * (unknown / unsupported types pass-through). Exposed for testing.
 */
export function matchesContentTypeUrl(
  url: string,
  contentType: ContentTypeKey | null | undefined,
): boolean {
  if (!contentType) return true;
  const rules = CONTENT_URL_RULES_BY_TYPE[contentType];
  if (!rules || rules.length === 0) return true;
  return rules.some((re) => re.test(url));
}

/**
 * True when the path matches any of the per-source deny patterns.
 * Patterns are interpreted as case-insensitive substring matches
 * unless they begin with `^` or end with `$` (in which case they are
 * compiled as regex). Always supports plain prefix matches like
 * `/articles/`.
 */
function matchesAnyPattern(url: string, patterns: ReadonlyArray<string> | null | undefined): boolean {
  if (!patterns || patterns.length === 0) return false;
  for (const pattern of patterns) {
    try {
      if (pattern.startsWith("^") || pattern.endsWith("$")) {
        if (new RegExp(pattern, "i").test(url)) return true;
        continue;
      }
      if (url.toLowerCase().includes(pattern.toLowerCase())) return true;
    } catch {
      // Bad pattern — ignore.
    }
  }
  return false;
}

export async function runFactoryNativeDiscovery(
  input: FactoryDiscoveryInput,
): Promise<FactoryDiscoveryResult> {
  const limit = input.maxUrlsPerRun ?? DEFAULT_MAX_URLS;
  const result: FactoryDiscoveryResult = {
    ok: false,
    feedUrlCount: 0,
    discoveredCount: 0,
    enqueuedCount: 0,
    skippedNonContentCount: 0,
    skippedTypeMismatchCount: 0,
  };

  let feedText: string;
  try {
    const res = await fetch(input.discoveryFeedUrl, {
      headers: { "User-Agent": "ViaFideiContentFactory/1.0 (+factory-native-discovery)" },
    });
    if (!res.ok) {
      result.errorMessage = `Feed fetch failed: HTTP ${res.status}`;
      return result;
    }
    feedText = await res.text();
  } catch (e) {
    result.errorMessage = e instanceof Error ? e.message : String(e);
    return result;
  }

  // Extract <loc>...</loc> URLs. Handles sitemap.xml and most RSS
  // shapes since both nest the URL inside <loc> / <link>.
  const allUrls = extractSitemapUrls(feedText);
  const sameHostUrls = allUrls.filter((url) => isSameHost(url, input.sourceHost));
  if (sameHostUrls.length < allUrls.length) {
    logger.warn("worker.factory_discovery.cross_host_urls_dropped", {
      sourceId: input.sourceId,
      sourceHost: input.sourceHost,
      dropped: allUrls.length - sameHostUrls.length,
    });
  }
  // Canonicalize and de-duplicate. A sitemap that lists
  // `https://example.org/x` AND `https://example.org/x/?utm_source=feed`
  // should produce ONE DiscoveredSourceItem, not two.
  const seen = new Set<string>();
  const canonical: string[] = [];
  for (const raw of sameHostUrls) {
    const canon = canonicalizeDiscoveredUrl(raw);
    if (seen.has(canon)) continue;
    seen.add(canon);
    canonical.push(canon);
  }
  result.feedUrlCount = canonical.length;

  // Filter pass. Hard negatives ALWAYS drop a URL — a /articles/,
  // /news/, /events/, /livestream/, /donate/, /register/ page can
  // never become a content package. When the caller hinted at a
  // specific content type, positive URL rules let matching paths
  // pass even from broad sitemaps — but hard negatives still win.
  // Per-source deny / allow lists layer on top.
  const contentUrls: string[] = [];
  const requestedType = input.requestedContentType ?? null;
  const hasAllowPaths = !!(input.allowPaths && input.allowPaths.length > 0);
  for (const url of canonical) {
    if (NON_CONTENT_URL_RE.test(url)) {
      result.skippedNonContentCount += 1;
      continue;
    }
    if (matchesAnyPattern(url, input.denyPaths)) {
      result.skippedNonContentCount += 1;
      continue;
    }
    if (hasAllowPaths && !matchesAnyPattern(url, input.allowPaths)) {
      result.skippedTypeMismatchCount += 1;
      continue;
    }
    if (requestedType && !matchesContentTypeUrl(url, requestedType)) {
      result.skippedTypeMismatchCount += 1;
      continue;
    }
    contentUrls.push(url);
  }
  if (result.skippedNonContentCount > 0) {
    logger.info("worker.factory_discovery.non_content_urls_skipped", {
      sourceId: input.sourceId,
      sourceHost: input.sourceHost,
      skipped: result.skippedNonContentCount,
    });
  }
  if (result.skippedTypeMismatchCount > 0) {
    logger.info("worker.factory_discovery.type_mismatch_skipped", {
      sourceId: input.sourceId,
      sourceHost: input.sourceHost,
      requestedContentType: requestedType,
      skipped: result.skippedTypeMismatchCount,
    });
  }

  const urls = contentUrls.slice(0, limit);
  for (const url of urls) {
    try {
      const id = await recordDiscoveredItem({
        sourceId: input.sourceId,
        // The factory-native path uses the URL itself as the external
        // key — every URL is unique within a source.
        adapterKey: `factory-native:${input.sourceHost}`,
        externalKey: url,
        sourceUrl: url,
        contentType: requestedType,
      });
      if (id) {
        result.discoveredCount += 1;
      }
      // Enqueue a source_fetch job for the URL. The handler is
      // idempotent — if the URL was already fetched, source_fetch
      // will short-circuit on the SourceDocument unique constraint.
      // contentType is carried in BOTH the queue row column (for
      // grouping / filtering) and the payload (where build-enqueue
      // reads it as the requestedContentType hint).
      await enqueueJob({
        jobName: `source_fetch:${input.sourceHost}`,
        jobKind: "source_fetch",
        dedupeKey: requestedType ? `source_fetch:${requestedType}:${url}` : `source_fetch:${url}`,
        sourceId: input.sourceId,
        contentType: requestedType,
        priority: PRIORITY_NORMAL,
        triggeredBy: "automatic",
        payload: {
          sourceUrl: url,
          sourceId: input.sourceId,
          discoveredItemId: id ?? undefined,
          contentType: requestedType ?? undefined,
        },
      });
      result.enqueuedCount += 1;
    } catch (e) {
      logger.warn("worker.factory_discovery.url_enqueue_failed", {
        sourceId: input.sourceId,
        url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  result.ok = true;
  logger.info("worker.factory_discovery.completed", {
    sourceId: input.sourceId,
    workerJobId: input.workerJobId,
    requestedContentType: requestedType,
    feedUrlCount: result.feedUrlCount,
    discoveredCount: result.discoveredCount,
    enqueuedCount: result.enqueuedCount,
    skippedNonContentCount: result.skippedNonContentCount,
    skippedTypeMismatchCount: result.skippedTypeMismatchCount,
  });
  return result;
}
