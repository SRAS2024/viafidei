/**
 * Open keyword web-search discovery for the Admin Worker.
 *
 * The link-crawler reaches sites that the Catholic sources it knows link to.
 * This module lets the worker ALSO find sources that *nothing it knows links
 * to*, by querying a real search engine for a content type's topics and seeding
 * the results as candidate URLs — true "search the whole internet for X."
 *
 * Providers, first that returns wins:
 *   1. Google Programmable Search (Custom Search JSON API):
 *      GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID
 *   2. Bing Web Search: BING_SEARCH_API_KEY
 *   3. KEYLESS DuckDuckGo HTML endpoint — no API key required, so the worker can
 *      "search the whole web" out of the box (the keyless default the site owner
 *      asked for). Fail-open and on by default; set
 *      `ADMIN_WORKER_KEYLESS_WEB_SEARCH=0` (or `false`/`off`/`no`) to opt out.
 *
 * Accuracy is unchanged: search only SEEDS candidate URLs. Every result still
 * runs the full pipeline — `isFetchableHost` / junk-host filtering on insert,
 * then classification, cross-source verification, and strict QA — before
 * anything can publish. (`discoverCandidate` already drops social/commerce/junk
 * hosts.) Search discovery also respects ADMIN_WORKER_SKIP_NETWORK.
 */

import type { CandidateSourceDiscoveryMethod, PrismaClient } from "@prisma/client";

import { discoverCandidate } from "./web-navigator";

const TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}

function googleConfig(): { key: string; cx: string } | null {
  const key = (process.env.GOOGLE_SEARCH_API_KEY ?? "").trim();
  const cx = (process.env.GOOGLE_SEARCH_ENGINE_ID ?? "").trim();
  if (!key || !cx) return null;
  return { key, cx };
}

function bingKey(): string | null {
  const k = (process.env.BING_SEARCH_API_KEY ?? "").trim();
  return k || null;
}

/**
 * Whether the keyless DuckDuckGo provider may run. Default ON — it needs no API
 * key, so open web search works with zero configuration. Disabled by an explicit
 * opt-out or offline mode.
 */
export function keylessWebSearchEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_KEYLESS_WEB_SEARCH ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

/** Is any open keyword web-search provider available (keyed OR keyless)? */
export function webSearchEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  return Boolean(googleConfig() || bingKey()) || keylessWebSearchEnabled();
}

function withTimeout(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Run a single keyword query against the configured search engine. Returns []
 * when no provider is configured or the call fails (defensive — never throws).
 */
export async function webSearch(query: string, count = 10): Promise<WebSearchResult[]> {
  if (!query.trim() || process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return [];
  const google = googleConfig();
  if (google) {
    const r = await viaGoogle(query, count, google).catch(() => null);
    if (r && r.length) return r;
  }
  const bing = bingKey();
  if (bing) {
    const r = await viaBing(query, count, bing).catch(() => null);
    if (r && r.length) return r;
  }
  // Keyless fallback — no API key required.
  if (keylessWebSearchEnabled()) {
    const r = await viaDuckDuckGo(query, count).catch(() => null);
    if (r && r.length) return r;
  }
  return [];
}

async function viaGoogle(
  query: string,
  count: number,
  cfg: { key: string; cx: string },
): Promise<WebSearchResult[] | null> {
  const { signal, clear } = withTimeout();
  try {
    const url =
      `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cfg.key)}` +
      `&cx=${encodeURIComponent(cfg.cx)}&num=${Math.min(10, count)}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{ link?: unknown; title?: unknown; snippet?: unknown }>;
    };
    return (data.items ?? [])
      .map((i) => ({
        url: typeof i.link === "string" ? i.link : "",
        title: typeof i.title === "string" ? i.title : "",
        snippet: typeof i.snippet === "string" ? i.snippet : "",
      }))
      .filter((r) => r.url);
  } finally {
    clear();
  }
}

async function viaBing(
  query: string,
  count: number,
  key: string,
): Promise<WebSearchResult[] | null> {
  const { signal, clear } = withTimeout();
  try {
    const url =
      `https://api.bing.microsoft.com/v7.0/search?count=${Math.min(50, count)}` +
      `&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal,
      headers: { "Ocp-Apim-Subscription-Key": key, "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      webPages?: { value?: Array<{ url?: unknown; name?: unknown; snippet?: unknown }> };
    };
    return (data.webPages?.value ?? [])
      .map((i) => ({
        url: typeof i.url === "string" ? i.url : "",
        title: typeof i.name === "string" ? i.name : "",
        snippet: typeof i.snippet === "string" ? i.snippet : "",
      }))
      .filter((r) => r.url);
  } finally {
    clear();
  }
}

/**
 * Parse DuckDuckGo's HTML SERP into results. The HTML endpoint renders each hit
 * as an `<a class="result__a" href="...">Title</a>`, where the href is a
 * `/l/?uddg=<url-encoded-target>` redirect. Exported so the parser is
 * unit-testable without a network call.
 */
export function parseDuckDuckGoHtml(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  const anchorRe =
    /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const rawHref = m[1].replace(/&amp;/g, "&");
    let url = "";
    const uddg = /[?&]uddg=([^&]+)/.exec(rawHref);
    if (uddg) {
      try {
        url = decodeURIComponent(uddg[1]);
      } catch {
        url = "";
      }
    } else if (rawHref.startsWith("//")) {
      url = `https:${rawHref}`;
    } else if (/^https?:\/\//i.test(rawHref)) {
      url = rawHref;
    }
    if (!url || seen.has(url)) continue;
    // Skip DuckDuckGo's own ad/redirect chrome.
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      continue;
    }
    if (/(^|\.)duckduckgo\.com$/i.test(host)) continue;
    seen.add(url);
    const title = m[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    results.push({ url, title, snippet: "" });
  }
  return results;
}

async function viaDuckDuckGo(query: string, count: number): Promise<WebSearchResult[] | null> {
  const { signal, clear } = withTimeout();
  try {
    // POST to the HTML endpoint (avoids the JS-only main site and is keyless).
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return null;
    return parseDuckDuckGoHtml(await res.text()).slice(0, count);
  } finally {
    clear();
  }
}

/**
 * Keyword templates per content type — phrased to surface authoritative Catholic
 * content and the index/listing pages the link-crawler can then spider. Every
 * query is biased "catholic" so the result set is on-topic; relevance and
 * communion are still judged downstream.
 */
export function queriesForContentType(contentType?: string): string[] {
  const ct = (contentType ?? "").toUpperCase();
  const map: Record<string, string[]> = {
    SAINT: [
      "Catholic saint biography feast day",
      "lives of the saints Catholic index",
      "list of Catholic saints A to Z",
    ],
    DOCTOR: ["Doctors of the Church Catholic list biography", "33 Doctors of the Church explained"],
    POPE: ["list of popes Catholic biography", "papal biographies Vatican", "every pope in order"],
    PRAYER: [
      "traditional Catholic prayers texts",
      "Catholic prayer book index",
      "complete list of Catholic prayers with text",
    ],
    LITANY: ["approved Catholic litanies texts", "list of Catholic litanies full text"],
    NOVENA: ["Catholic novena prayers nine days", "list of Catholic novenas full text"],
    GUIDE: ["how to pray Catholic guide", "Catholic devotional how-to"],
    DEVOTION: ["Catholic devotions list explained", "popular Catholic devotions index"],
    SPIRITUAL_PRACTICE: [
      "Catholic spiritual practices disciplines",
      "Catholic spiritual disciplines list",
    ],
    MARIAN_TITLE: [
      "titles of the Blessed Virgin Mary Catholic list",
      "names and titles of Mary Catholic",
    ],
    APPARITION: ["approved Marian apparitions Catholic Church", "Church-approved apparitions list"],
    CHURCH_DOCUMENT: [
      "papal encyclical full text",
      "Vatican magisterial documents list",
      "list of papal encyclicals full text",
    ],
    LITURGICAL: [
      "Catholic liturgical calendar feasts seasons",
      "General Roman Calendar feast days",
    ],
    RITE: ["Catholic rites Latin Eastern liturgical", "list of liturgical rites Catholic Church"],
    SACRAMENT: ["seven sacraments of the Catholic Church"],
    PARISH: [
      "Catholic parish directory diocese",
      "list of Catholic parishes diocese website",
      "Catholic diocese parish finder directory",
    ],
  };
  const base = map[ct] ?? ["Catholic Church teaching reference"];
  // Parish coverage benefits most from locality — mirror how a person would
  // search city by city. Seed location-aware queries from the operator list.
  if (ct === "PARISH") {
    const locations = (process.env.PARISH_DISCOVERY_LOCATIONS ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    // Locality first — that's how a person hunts down every parish, city by city.
    return [...locations.map((loc) => `Catholic parishes in ${loc} parish directory`), ...base];
  }
  return base;
}

export interface WebSearchDiscoveryResult {
  enabled: boolean;
  queriesRun: number;
  found: number;
  inserted: number;
  errors: string[];
}

/**
 * Run keyword web-search for a content type and seed the results as candidate
 * URLs. Bounded per pass to keep search-API cost small; results are unverified
 * candidates that the normal pipeline must still validate before publishing.
 */
export async function discoverFromWebSearch(
  prisma: PrismaClient,
  contentType?: string,
  opts: { maxQueries?: number; resultsPerQuery?: number } = {},
): Promise<WebSearchDiscoveryResult> {
  const out: WebSearchDiscoveryResult = {
    enabled: webSearchEnabled(),
    queriesRun: 0,
    found: 0,
    inserted: 0,
    errors: [],
  };
  if (!out.enabled) return out;

  const queries = queriesForContentType(contentType).slice(0, opts.maxQueries ?? 2);
  for (const query of queries) {
    try {
      const results = await webSearch(query, opts.resultsPerQuery ?? 10);
      out.queriesRun += 1;
      out.found += results.length;
      for (const r of results) {
        let host = "";
        try {
          host = new URL(r.url).host;
        } catch {
          continue;
        }
        const row = await discoverCandidate(prisma, {
          url: r.url,
          sourceHost: host,
          discoveryMethod: "SEARCH_PAGE" as CandidateSourceDiscoveryMethod,
          predictedContentType: contentType,
          predictedUsefulness: 0.45,
        }).catch(() => null);
        if (row && row.status !== "REJECTED") out.inserted += 1;
      }
    } catch (e) {
      out.errors.push(`${query}: ${e instanceof Error ? e.message : "search failed"}`);
    }
  }
  return out;
}
