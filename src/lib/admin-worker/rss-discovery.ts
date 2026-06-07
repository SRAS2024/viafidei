/**
 * RSS / Atom feed discovery. Complements `sitemap-discovery.ts` for
 * sources that publish via syndication feeds (most Catholic
 * publishers do). Reads a known-feed URL, parses out `<item><link>`
 * or `<entry><link>` URLs, applies the existing junk-URL classifier,
 * and inserts the survivors as `CandidateSourceUrl` rows.
 *
 * Scope (spec section 5): only approved hosts, junk-URL classification
 * before fetch, no DOM parser (text-only XML scan), per-host timeout +
 * size caps.
 */

import type { CandidateSourceDiscoveryMethod, PrismaClient } from "@prisma/client";

import { isApprovedAuthorityHost } from "@/lib/checklist";
import { discoverCandidate, isJunkUrl } from "./web-navigator";
import { writeAdminWorkerLog } from "./logs";

const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+rss-discovery)";
const MAX_ITEMS = 100;
const MAX_BYTES = 3_000_000;

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BYTES) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Extract item URLs from RSS 2.0 (`<item><link>...</link></item>`)
 * and Atom (`<entry><link href="..."/></entry>`). Permissive; the
 * goal is to capture URLs without dragging in a DOM parser.
 */
export function extractFeedUrls(xml: string): string[] {
  const out: string[] = [];

  // RSS 2.0: <link>https://example.org/x</link>
  const rss = /<link>\s*([^<\s]+)\s*<\/link>/gi;
  let match: RegExpExecArray | null;
  while ((match = rss.exec(xml)) !== null) {
    out.push(match[1].trim());
    if (out.length >= MAX_ITEMS) return out;
  }

  // Atom: <link href="https://example.org/x"/>
  const atom = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = atom.exec(xml)) !== null) {
    out.push(match[1].trim());
    if (out.length >= MAX_ITEMS) return out;
  }

  return out;
}

export interface RssDiscoveryOutcome {
  host: string;
  feedUrl: string;
  fetched: boolean;
  inserted: number;
  rejected: number;
  reason?: string;
}

export async function discoverFromFeed(
  prisma: PrismaClient,
  feedUrl: string,
): Promise<RssDiscoveryOutcome> {
  let parsedHost = "";
  try {
    parsedHost = new URL(feedUrl).host;
  } catch {
    return { host: "", feedUrl, fetched: false, inserted: 0, rejected: 0, reason: "invalid URL" };
  }
  if (!isApprovedAuthorityHost(parsedHost)) {
    return {
      host: parsedHost,
      feedUrl,
      fetched: false,
      inserted: 0,
      rejected: 0,
      reason: "host not approved",
    };
  }

  const body = await fetchFeed(feedUrl);
  if (!body) {
    return {
      host: parsedHost,
      feedUrl,
      fetched: false,
      inserted: 0,
      rejected: 0,
      reason: "feed fetch failed",
    };
  }

  const urls = extractFeedUrls(body);
  let inserted = 0;
  let rejected = 0;

  for (const url of urls) {
    const urlHost = (() => {
      try {
        return new URL(url).host;
      } catch {
        return null;
      }
    })();
    if (!urlHost || !isApprovedAuthorityHost(urlHost)) {
      rejected += 1;
      continue;
    }
    if (isJunkUrl(url).junk) {
      rejected += 1;
      continue;
    }
    const row = await discoverCandidate(prisma, {
      url,
      sourceHost: urlHost,
      discoveryMethod: "RSS" as CandidateSourceDiscoveryMethod,
      predictedUsefulness: 0.65,
    });
    if (row) inserted += 1;
    else rejected += 1;
  }

  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "rss_discovery",
    message: `RSS discovery from ${feedUrl}: inserted=${inserted}, rejected=${rejected}`,
    sourceHost: parsedHost,
    sourceUrl: feedUrl,
    safeMetadata: { inserted, rejected },
  });

  return { host: parsedHost, feedUrl, fetched: true, inserted, rejected };
}
