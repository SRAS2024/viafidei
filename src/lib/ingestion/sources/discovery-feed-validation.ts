/**
 * Discovery-feed validators (spec §15).
 *
 * One validator per discovery method:
 *
 *   - sitemap        → must look like a sitemap.xml (root tag <urlset>
 *                      or <sitemapindex>, plus at least one <loc>)
 *   - rss            → must look like an RSS or Atom feed
 *   - fixed_url_list → must be a JSON array of URLs OR a newline-
 *                      separated list of URLs
 *   - official_api   → must respond with JSON or XML and return 2xx
 *   - factory_handler → handler key must resolve to a registered
 *                      factory-native handler
 *
 * The validators are pure: they take the fetched body as input and
 * return a structured result. The queue layer wraps them with HTTP
 * + cache when running source-config-repair.
 */

export type DiscoveryFeedValidationResult = {
  ok: boolean;
  method: string;
  reason: string;
  /** When ok, how many URLs / entries the feed exposes. */
  entryCount?: number;
};

export function validateSitemap(body: string): DiscoveryFeedValidationResult {
  if (!body || body.trim().length === 0) {
    return { ok: false, method: "sitemap", reason: "Empty sitemap body" };
  }
  const lowered = body.slice(0, 2000).toLowerCase();
  if (!lowered.includes("<urlset") && !lowered.includes("<sitemapindex")) {
    return {
      ok: false,
      method: "sitemap",
      reason: "Document does not contain a <urlset> or <sitemapindex> root",
    };
  }
  const locs = body.match(/<loc>([^<]+)<\/loc>/gi) ?? [];
  if (locs.length === 0) {
    return {
      ok: false,
      method: "sitemap",
      reason: "Sitemap has no <loc> entries",
      entryCount: 0,
    };
  }
  return {
    ok: true,
    method: "sitemap",
    reason: `Sitemap parsed with ${locs.length} URL(s)`,
    entryCount: locs.length,
  };
}

export function validateRssFeed(body: string): DiscoveryFeedValidationResult {
  if (!body || body.trim().length === 0) {
    return { ok: false, method: "rss", reason: "Empty RSS body" };
  }
  const lowered = body.slice(0, 2000).toLowerCase();
  const isRss = lowered.includes("<rss") || lowered.includes("<channel");
  const isAtom = lowered.includes("<feed") && lowered.includes("xmlns");
  if (!isRss && !isAtom) {
    return {
      ok: false,
      method: "rss",
      reason: "Document does not look like RSS or Atom (missing <rss>/<channel>/<feed>)",
    };
  }
  const items = body.match(/<item[\s>]/gi) ?? [];
  const entries = body.match(/<entry[\s>]/gi) ?? [];
  const total = items.length + entries.length;
  if (total === 0) {
    return {
      ok: false,
      method: "rss",
      reason: "Feed has no <item> or <entry> elements",
      entryCount: 0,
    };
  }
  return {
    ok: true,
    method: "rss",
    reason: `RSS/Atom feed parsed with ${total} entry/entries`,
    entryCount: total,
  };
}

export function validateFixedUrlList(body: string): DiscoveryFeedValidationResult {
  if (!body || body.trim().length === 0) {
    return { ok: false, method: "fixed_url_list", reason: "Empty body" };
  }
  // Try JSON array first.
  const trimmed = body.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed))
        return {
          ok: false,
          method: "fixed_url_list",
          reason: "JSON parsed but root is not an array",
        };
      const urls = parsed.filter((v) => typeof v === "string" && /^https?:\/\//.test(v));
      if (urls.length === 0)
        return {
          ok: false,
          method: "fixed_url_list",
          reason: "JSON array contains no http(s) URLs",
          entryCount: 0,
        };
      return {
        ok: true,
        method: "fixed_url_list",
        reason: `Fixed URL list parsed with ${urls.length} URL(s)`,
        entryCount: urls.length,
      };
    } catch (e) {
      return {
        ok: false,
        method: "fixed_url_list",
        reason: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
  // Fall back to newline-separated.
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const urls = lines.filter((l) => /^https?:\/\//.test(l));
  if (urls.length === 0) {
    return {
      ok: false,
      method: "fixed_url_list",
      reason: "No http(s) URLs found in newline-separated body",
      entryCount: 0,
    };
  }
  return {
    ok: true,
    method: "fixed_url_list",
    reason: `Fixed URL list parsed with ${urls.length} URL(s)`,
    entryCount: urls.length,
  };
}

export function validateOfficialApiResponse(opts: {
  body: string;
  contentType?: string | null;
  status?: number;
}): DiscoveryFeedValidationResult {
  if (opts.status !== undefined && (opts.status < 200 || opts.status >= 300)) {
    return {
      ok: false,
      method: "official_api",
      reason: `Non-2xx status: ${opts.status}`,
    };
  }
  if (!opts.body || opts.body.trim().length === 0) {
    return { ok: false, method: "official_api", reason: "Empty body" };
  }
  const ct = (opts.contentType ?? "").toLowerCase();
  const bodySnippet = opts.body.slice(0, 200).trim();
  const looksJson =
    ct.includes("application/json") || bodySnippet.startsWith("{") || bodySnippet.startsWith("[");
  const looksXml = ct.includes("xml") || bodySnippet.startsWith("<");
  if (!looksJson && !looksXml) {
    return {
      ok: false,
      method: "official_api",
      reason: "Body does not look like JSON or XML",
    };
  }
  return {
    ok: true,
    method: "official_api",
    reason: looksJson ? "Official API returned JSON" : "Official API returned XML",
  };
}

/** Registered factory-native handler keys. Must be kept in lockstep
 *  with the worker dispatch table. */
const REGISTERED_FACTORY_HANDLERS = new Set<string>(["factory_native", "factory_handler"]);

export function validateFactoryHandler(handlerKey: string): DiscoveryFeedValidationResult {
  if (!handlerKey) {
    return { ok: false, method: "factory_handler", reason: "No handler key provided" };
  }
  if (!REGISTERED_FACTORY_HANDLERS.has(handlerKey)) {
    return {
      ok: false,
      method: "factory_handler",
      reason: `Handler key '${handlerKey}' is not registered`,
    };
  }
  return {
    ok: true,
    method: "factory_handler",
    reason: `Handler '${handlerKey}' is registered`,
  };
}
