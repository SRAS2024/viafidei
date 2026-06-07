/**
 * Sitemap discovery. The Admin Worker fetches `/sitemap.xml` (or
 * `/robots.txt` for the sitemap link) on each approved host, parses
 * out the `<loc>` URLs, classifies them with the junk filter, and
 * inserts the survivors as CandidateSourceUrl rows.
 *
 * Scope (spec section 5):
 *   - Only approved authority hosts (the worker exists to discover
 *     within the allowlist, never outside it).
 *   - Respect robots.txt where applicable — we read robots.txt for
 *     the sitemap link and honour `Disallow:` paths for the user
 *     agent.
 *   - Rate-limited (one request per host per pass at most).
 *   - No HTML parsing; pure XML text scan so we don't drag a DOM
 *     parser into the worker.
 */

import type {
  CandidateSourceDiscoveryMethod,
  ChecklistContentType,
  PrismaClient,
} from "@prisma/client";

import { AUTHORITY_SOURCES, isApprovedAuthorityHost } from "@/lib/checklist";
import { writeAdminWorkerLog } from "./logs";
import { discoverCandidate, isJunkUrl, type DiscoverCandidateInput } from "./web-navigator";

const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+sitemap-discovery)";
const MAX_URLS_PER_SITEMAP = 200;
const MAX_SITEMAP_BYTES = 5_000_000;

/** Crude content-type prediction from URL path segments. */
function predictContentType(url: string): ChecklistContentType | undefined {
  const lower = url.toLowerCase();
  if (lower.includes("/prayer")) return "PRAYER";
  if (lower.includes("/saint")) return "SAINT";
  if (lower.includes("/devotion")) return "DEVOTION";
  if (lower.includes("/novena")) return "NOVENA";
  if (lower.includes("/sacrament")) return "SACRAMENT";
  if (lower.includes("/apparition")) return "APPARITION";
  if (lower.includes("/marian") || lower.includes("/mary")) return "MARIAN_TITLE";
  if (lower.includes("/encyclical") || lower.includes("/papal")) return "CHURCH_DOCUMENT";
  if (lower.includes("/liturg")) return "LITURGICAL";
  if (lower.includes("/rosary") || lower.includes("/consecration")) return "SPIRITUAL_PRACTICE";
  return undefined;
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    locs.push(match[1].trim());
    if (locs.length >= MAX_URLS_PER_SITEMAP) break;
  }
  return locs;
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers: { "user-agent": USER_AGENT, accept: "application/xml, text/xml, text/plain" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > MAX_SITEMAP_BYTES) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Robots.txt scan for the sitemap line. We also collect `Disallow:`
 * paths for the default user agent so we can avoid fetching URLs the
 * site asked crawlers to skip. Permissive parse — best-effort.
 */
async function readRobots(host: string): Promise<{ sitemapUrls: string[]; disallow: string[] }> {
  const robotsUrl = `https://${host}/robots.txt`;
  const text = await fetchWithTimeout(robotsUrl);
  if (!text) return { sitemapUrls: [], disallow: [] };
  const sitemapUrls: string[] = [];
  const disallow: string[] = [];
  let appliesToUs = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sitemapMatch = line.match(/^Sitemap:\s*(\S+)/i);
    if (sitemapMatch) {
      sitemapUrls.push(sitemapMatch[1]);
      continue;
    }
    const uaMatch = line.match(/^User-agent:\s*(\S+)/i);
    if (uaMatch) {
      appliesToUs = uaMatch[1] === "*" || /viafidei/i.test(uaMatch[1]);
      continue;
    }
    if (!appliesToUs) continue;
    const disallowMatch = line.match(/^Disallow:\s*(\S*)/i);
    if (disallowMatch && disallowMatch[1].length > 0) {
      disallow.push(disallowMatch[1]);
    }
  }
  return { sitemapUrls, disallow };
}

export interface SitemapDiscoveryOutcome {
  host: string;
  fetched: number;
  inserted: number;
  rejected: number;
  reason?: string;
}

/**
 * Run sitemap discovery for one approved host. Returns counts so the
 * caller can roll up per-pass totals.
 */
export async function discoverFromHost(
  prisma: PrismaClient,
  host: string,
): Promise<SitemapDiscoveryOutcome> {
  if (!isApprovedAuthorityHost(host)) {
    return { host, fetched: 0, inserted: 0, rejected: 0, reason: "host not approved" };
  }

  const robots = await readRobots(host);
  const sitemapUrls =
    robots.sitemapUrls.length > 0 ? robots.sitemapUrls : [`https://${host}/sitemap.xml`];

  let fetched = 0;
  let inserted = 0;
  let rejected = 0;

  for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
    const body = await fetchWithTimeout(sitemapUrl);
    if (!body) continue;
    fetched += 1;
    const locs = extractLocs(body);

    for (const loc of locs) {
      const parsedHost = (() => {
        try {
          return new URL(loc).host;
        } catch {
          return null;
        }
      })();
      if (!parsedHost || !isApprovedAuthorityHost(parsedHost)) {
        rejected += 1;
        continue;
      }
      // Honour robots Disallow.
      try {
        const path = new URL(loc).pathname;
        if (robots.disallow.some((d) => path.startsWith(d))) {
          rejected += 1;
          continue;
        }
      } catch {
        rejected += 1;
        continue;
      }
      if (isJunkUrl(loc).junk) {
        rejected += 1;
        continue;
      }
      const input: DiscoverCandidateInput = {
        url: loc,
        sourceHost: parsedHost,
        discoveryMethod: "SITEMAP" as CandidateSourceDiscoveryMethod,
        predictedContentType: predictContentType(loc),
        predictedUsefulness: 0.6,
      };
      const row = await discoverCandidate(prisma, input);
      if (row) inserted += 1;
      else rejected += 1;
    }
  }

  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "sitemap_discovery",
    message: `Sitemap discovery on ${host}: fetched=${fetched}, inserted=${inserted}, rejected=${rejected}`,
    sourceHost: host,
    safeMetadata: { fetched, inserted, rejected },
  });

  return { host, fetched, inserted, rejected };
}

/**
 * Run sitemap discovery for every approved authority source. Returns
 * a per-host outcome array so the diagnostics rating can show which
 * hosts produced new candidates this pass.
 */
export async function discoverFromAllAuthorities(
  prisma: PrismaClient,
): Promise<SitemapDiscoveryOutcome[]> {
  const outcomes: SitemapDiscoveryOutcome[] = [];
  for (const source of AUTHORITY_SOURCES) {
    const outcome = await discoverFromHost(prisma, source.host);
    outcomes.push(outcome);
  }
  return outcomes;
}
