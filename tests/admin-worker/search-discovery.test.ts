/**
 * Open keyword web-search discovery lets the worker find sources nothing it
 * knows links to. These tests pin the SAFE DEFAULTS: with no search-engine key
 * configured it is disabled and returns nothing; query templates are on-topic
 * per content type; and ADMIN_WORKER_SKIP_NETWORK forces it off.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  discoverFromWebSearch,
  parseDuckDuckGoHtml,
  queriesForContentType,
  webSearch,
  webSearchEnabled,
} from "@/lib/admin-worker/search-discovery";

const KEYS = [
  "GOOGLE_SEARCH_API_KEY",
  "GOOGLE_SEARCH_ENGINE_ID",
  "BING_SEARCH_API_KEY",
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_KEYLESS_WEB_SEARCH",
  "PARISH_DISCOVERY_LOCATIONS",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("web-search discovery", () => {
  it("is KEYLESS-enabled by default — no search key required", () => {
    // DuckDuckGo provides keyless web search out of the box.
    expect(webSearchEnabled()).toBe(true);
  });

  it("is fully disabled and finds nothing only when keyless is opted out and no key is set", async () => {
    process.env.ADMIN_WORKER_KEYLESS_WEB_SEARCH = "0";
    expect(webSearchEnabled()).toBe(false);
    expect(await webSearch("Saint Thomas Aquinas")).toEqual([]);
    const prisma = {} as never;
    const r = await discoverFromWebSearch(prisma, "SAINT");
    expect(r.enabled).toBe(false);
    expect(r.inserted).toBe(0);
    expect(r.queriesRun).toBe(0);
  });

  it("reports enabled once a Google Programmable Search key + engine id are present", () => {
    process.env.ADMIN_WORKER_KEYLESS_WEB_SEARCH = "0";
    process.env.GOOGLE_SEARCH_API_KEY = "k";
    process.env.GOOGLE_SEARCH_ENGINE_ID = "cx";
    expect(webSearchEnabled()).toBe(true);
  });

  it("reports enabled with a Bing key", () => {
    process.env.ADMIN_WORKER_KEYLESS_WEB_SEARCH = "0";
    process.env.BING_SEARCH_API_KEY = "k";
    expect(webSearchEnabled()).toBe(true);
  });

  it("stays disabled in skip-network mode even with a key", () => {
    process.env.GOOGLE_SEARCH_API_KEY = "k";
    process.env.GOOGLE_SEARCH_ENGINE_ID = "cx";
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    expect(webSearchEnabled()).toBe(false);
  });

  it("seeds location-aware parish queries from PARISH_DISCOVERY_LOCATIONS, locality first", () => {
    process.env.PARISH_DISCOVERY_LOCATIONS = "Boston, MA; Rome, Italy";
    const qs = queriesForContentType("PARISH");
    expect(qs[0]).toMatch(/Boston, MA/);
    expect(qs.join(" ")).toMatch(/Rome, Italy/);
    expect(qs.join(" ")).toMatch(/parish/i);
  });

  it("builds on-topic, Catholic-biased queries per content type", () => {
    expect(queriesForContentType("SAINT").join(" ")).toMatch(/saint/i);
    expect(queriesForContentType("CHURCH_DOCUMENT").join(" ")).toMatch(
      /encyclical|vatican|document/i,
    );
    expect(queriesForContentType("MARIAN_TITLE").join(" ")).toMatch(/mary|marian|virgin/i);
    // Unknown type still yields a safe Catholic query rather than nothing.
    expect(queriesForContentType().length).toBeGreaterThan(0);
    expect(queriesForContentType("WHATEVER").join(" ")).toMatch(/catholic/i);
  });
});

describe("parseDuckDuckGoHtml", () => {
  it("decodes the uddg redirect into the real target URL + title", () => {
    const html = `
      <div class="result">
        <a rel="nofollow" class="result__a"
           href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.usccb.org%2Fprayers&amp;rut=abc">
          USCCB Prayers
        </a>
      </div>`;
    const results = parseDuckDuckGoHtml(html);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://www.usccb.org/prayers");
    expect(results[0].title).toBe("USCCB Prayers");
  });

  it("dedupes results and skips DuckDuckGo's own chrome", () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fa">A</a>
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fa">A dup</a>
      <a class="result__a" href="https://duckduckgo.com/about">DDG</a>
      <a class="result__a" href="https://example.org/b">B</a>`;
    const urls = parseDuckDuckGoHtml(html).map((r) => r.url);
    expect(urls).toEqual(["https://example.org/a", "https://example.org/b"]);
  });

  it("returns nothing for markup with no result anchors", () => {
    expect(parseDuckDuckGoHtml("<html><body>no results</body></html>")).toEqual([]);
  });
});
