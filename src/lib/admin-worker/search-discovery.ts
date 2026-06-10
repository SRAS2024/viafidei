/**
 * Open keyword web-search discovery for the Admin Worker.
 *
 * The link-crawler reaches sites that the Catholic sources it knows link to.
 * This module lets the worker ALSO find sources that *nothing it knows links
 * to*, by querying a real search engine for a content type's topics and seeding
 * the results as candidate URLs — true "search the whole internet for X."
 *
 * Gated on a search-API key; a no-op when none is configured. Providers, first
 * configured wins:
 *   1. Google Programmable Search (Custom Search JSON API):
 *      GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID
 *   2. Bing Web Search: BING_SEARCH_API_KEY
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

/** Is any open keyword web-search provider configured? */
export function webSearchEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  return Boolean(googleConfig() || bingKey());
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
    if (r) return r;
  }
  const bing = bingKey();
  if (bing) {
    const r = await viaBing(query, count, bing).catch(() => null);
    if (r) return r;
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
 * Keyword templates per content type — phrased to surface authoritative Catholic
 * content and the index/listing pages the link-crawler can then spider. Every
 * query is biased "catholic" so the result set is on-topic; relevance and
 * communion are still judged downstream.
 */
export function queriesForContentType(contentType?: string): string[] {
  const ct = (contentType ?? "").toUpperCase();
  const map: Record<string, string[]> = {
    SAINT: ["Catholic saint biography feast day", "lives of the saints Catholic index"],
    DOCTOR: ["Doctors of the Church Catholic list biography"],
    POPE: ["list of popes Catholic biography", "papal biographies Vatican"],
    PRAYER: ["traditional Catholic prayers texts", "Catholic prayer book index"],
    LITANY: ["approved Catholic litanies texts"],
    NOVENA: ["Catholic novena prayers nine days"],
    GUIDE: ["how to pray Catholic guide", "Catholic devotional how-to"],
    DEVOTION: ["Catholic devotions list explained"],
    SPIRITUAL_PRACTICE: ["Catholic spiritual practices disciplines"],
    MARIAN_TITLE: ["titles of the Blessed Virgin Mary Catholic list"],
    APPARITION: ["approved Marian apparitions Catholic Church"],
    CHURCH_DOCUMENT: ["papal encyclical full text", "Vatican magisterial documents list"],
    LITURGICAL: ["Catholic liturgical calendar feasts seasons"],
    RITE: ["Catholic rites Latin Eastern liturgical"],
    SACRAMENT: ["seven sacraments of the Catholic Church"],
    PARISH: ["Catholic parish directory diocese"],
  };
  return map[ct] ?? ["Catholic Church teaching reference"];
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
