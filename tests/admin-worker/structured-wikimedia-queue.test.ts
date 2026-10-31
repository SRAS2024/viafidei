/**
 * Wikimedia's API etiquette asks automated clients to make their requests in
 * series and to back off when throttled. Every Wikipedia / Wikisource /
 * Wikidata-API request the structured layer makes goes through one in-process
 * queue; these tests pin that it is serial, that it leaves other hosts (and the
 * Query Service, which has its own gate) alone, and that a 429 pauses it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchJson,
  fetchText,
  isWikimediaUrl,
  resetWikimediaQueue,
  USER_AGENT,
} from "@/lib/admin-worker/structured/http";

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;
const realFetch = global.fetch;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  delete process.env[SKIP];
  resetWikimediaQueue();
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  global.fetch = realFetch;
  resetWikimediaQueue();
  vi.restoreAllMocks();
});

/** A fetch double that records peak concurrency per host family. */
function concurrencyProbe(delayMs = 5) {
  let inFlight = 0;
  let peak = 0;
  const agents: string[] = [];
  const fetchMock = vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
    agents.push(init?.headers?.["User-Agent"] ?? "");
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, delayMs));
    inFlight -= 1;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
      text: async () => "ok",
    };
  });
  global.fetch = fetchMock as unknown as typeof global.fetch;
  return { fetchMock, agents, peak: () => peak };
}

describe("Wikimedia request queue", () => {
  it("recognises the hosts that ask for serial requests", () => {
    expect(isWikimediaUrl("https://en.wikipedia.org/api/rest_v1/page/summary/X")).toBe(true);
    expect(isWikimediaUrl("https://it.wikipedia.org/w/api.php?action=parse")).toBe(true);
    expect(isWikimediaUrl("https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)")).toBe(
      true,
    );
    expect(isWikimediaUrl("https://www.wikidata.org/w/api.php")).toBe(true);
    // The Query Service is gated separately (wikidata.ts) and must not queue here.
    expect(isWikimediaUrl("https://query.wikidata.org/sparql")).toBe(false);
    expect(isWikimediaUrl("https://www.vatican.va/content/x.html")).toBe(false);
    expect(isWikimediaUrl("https://notwikipedia.org/x")).toBe(false);
  });

  it("never has two Wikimedia requests in flight, across callers", async () => {
    const probe = concurrencyProbe();
    await Promise.all([
      fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/A"),
      fetchJson("https://en.wikipedia.org/w/api.php?action=parse&page=A"),
      fetchText("https://en.wikisource.org/wiki/B"),
      fetchJson("https://de.wikipedia.org/api/rest_v1/page/summary/C"),
    ]);
    expect(probe.fetchMock).toHaveBeenCalledTimes(4);
    expect(probe.peak()).toBe(1);
    // Every request identifies the worker, as the User-Agent policy asks.
    expect(new Set(probe.agents)).toEqual(new Set([USER_AGENT]));
    expect(USER_AGENT).toMatch(/ViaFideiAdminWorker\/\d.*https:\/\/etviafidei\.com/);
  });

  it("does not queue other hosts", async () => {
    const probe = concurrencyProbe();
    await Promise.all([
      fetchJson("https://www.vatican.va/a.json"),
      fetchJson("https://www.vatican.va/b.json"),
      fetchJson("https://query.wikidata.org/sparql?query=x"),
    ]);
    expect(probe.peak()).toBeGreaterThan(1);
  });

  it("pauses the queue for a 429's Retry-After", async () => {
    vi.useFakeTimers();
    try {
      const calls: number[] = [];
      let first = true;
      global.fetch = vi.fn(async () => {
        calls.push(Date.now());
        if (first) {
          first = false;
          return {
            ok: false,
            status: 429,
            headers: { get: (h: string) => (h === "retry-after" ? "2" : null) },
          };
        }
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
      }) as unknown as typeof global.fetch;

      const a = fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/A");
      const b = fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/B");
      await vi.advanceTimersByTimeAsync(10);
      expect(await a).toBeNull();
      expect(calls).toHaveLength(1); // B waits out the Retry-After
      await vi.advanceTimersByTimeAsync(2_100);
      expect(await b).toEqual({});
      expect(calls).toHaveLength(2);
      expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(2_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
