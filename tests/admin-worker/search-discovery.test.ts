/**
 * Open keyword web-search discovery lets the worker find sources nothing it
 * knows links to. These tests pin the SAFE DEFAULTS: with no search-engine key
 * configured it is disabled and returns nothing; query templates are on-topic
 * per content type; and ADMIN_WORKER_SKIP_NETWORK forces it off.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  discoverFromWebSearch,
  queriesForContentType,
  webSearch,
  webSearchEnabled,
} from "@/lib/admin-worker/search-discovery";

const KEYS = [
  "GOOGLE_SEARCH_API_KEY",
  "GOOGLE_SEARCH_ENGINE_ID",
  "BING_SEARCH_API_KEY",
  "ADMIN_WORKER_SKIP_NETWORK",
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
  it("is disabled and finds nothing when no search key is configured", async () => {
    expect(webSearchEnabled()).toBe(false);
    expect(await webSearch("Saint Thomas Aquinas")).toEqual([]);
    const prisma = {} as never;
    const r = await discoverFromWebSearch(prisma, "SAINT");
    expect(r.enabled).toBe(false);
    expect(r.inserted).toBe(0);
    expect(r.queriesRun).toBe(0);
  });

  it("reports enabled once a Google Programmable Search key + engine id are present", () => {
    process.env.GOOGLE_SEARCH_API_KEY = "k";
    process.env.GOOGLE_SEARCH_ENGINE_ID = "cx";
    expect(webSearchEnabled()).toBe(true);
  });

  it("reports enabled with a Bing key", () => {
    process.env.BING_SEARCH_API_KEY = "k";
    expect(webSearchEnabled()).toBe(true);
  });

  it("stays disabled in skip-network mode even with a key", () => {
    process.env.GOOGLE_SEARCH_API_KEY = "k";
    process.env.GOOGLE_SEARCH_ENGINE_ID = "cx";
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    expect(webSearchEnabled()).toBe(false);
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
