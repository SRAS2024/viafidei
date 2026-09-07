/**
 * The Wikidata Query Service transport. The service allows one client 60 s of
 * processing per 60 s and answers 429 with a Retry-After; a 504 / client abort
 * means the server is STILL executing the query. These tests pin the contract
 * every caller relies on: `null` on failure vs `[]` on an empty answer, no
 * immediate retry after a timeout, Retry-After honoured (inline when short,
 * as a cool-down when long), a fail-fast while cooling, and the cool-down
 * persisted so a fresh process does not re-discover the throttle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  lastSparqlFailure,
  resetSparqlGateForTests,
  runSparql,
  sparqlCooldownUntil,
} from "@/lib/admin-worker/structured/wikidata";
import {
  SOURCE_COOLDOWN_KEY,
  persistSourceCooldown,
  readSourceCooldownMs,
} from "@/lib/admin-worker/structured/source-cooldown";

const realFetch = globalThis.fetch;
let savedSkip: string | undefined;
let savedEndpoints: string | undefined;

beforeEach(() => {
  savedSkip = process.env.ADMIN_WORKER_SKIP_NETWORK;
  savedEndpoints = process.env.WIKIDATA_SPARQL_ENDPOINTS;
  delete process.env.ADMIN_WORKER_SKIP_NETWORK;
  delete process.env.WIKIDATA_SPARQL_ENDPOINTS;
  resetSparqlGateForTests({ minSpacingMs: 0 });
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
  if (savedSkip === undefined) delete process.env.ADMIN_WORKER_SKIP_NETWORK;
  else process.env.ADMIN_WORKER_SKIP_NETWORK = savedSkip;
  if (savedEndpoints === undefined) delete process.env.WIKIDATA_SPARQL_ENDPOINTS;
  else process.env.WIKIDATA_SPARQL_ENDPOINTS = savedEndpoints;
  resetSparqlGateForTests();
});

function response(status: number, opts: { retryAfter?: string; bindings?: unknown[] } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "retry-after" ? (opts.retryAfter ?? null) : "application/json",
    },
    json: async () => ({ results: { bindings: opts.bindings ?? [] } }),
  } as unknown as Response;
}

function fetchSequence(...responses: Array<Response | Error>) {
  const calls: string[] = [];
  let i = 0;
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    calls.push(String(url));
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return calls;
}

describe("runSparql — failure vs empty", () => {
  it("returns [] for a genuinely empty answer and null when every endpoint is unreachable", async () => {
    fetchSequence(response(200, { bindings: [] }));
    expect(await runSparql("SELECT ?x WHERE {}")).toEqual([]);

    const calls = fetchSequence(new Error("ECONNRESET"));
    expect(await runSparql("SELECT ?x WHERE {}")).toBeNull();
    expect(calls).toHaveLength(1); // no retry on an unreachable endpoint
    expect(lastSparqlFailure()?.kind).toBe("unreachable");
    expect(sparqlCooldownUntil()).toBe(0);
  });

  it("returns null without touching the network when disabled", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const calls = fetchSequence(response(200));
    expect(await runSparql("SELECT ?x WHERE {}")).toBeNull();
    expect(calls).toHaveLength(0);
    expect(lastSparqlFailure()?.kind).toBe("disabled");
  });
});

describe("runSparql — timeout / throttle back-off", () => {
  it("does NOT retry a 504 (the server is still running the query) and cools for a minute", async () => {
    const calls = fetchSequence(response(504));
    const before = Date.now();

    expect(await runSparql("SELECT ?x WHERE {}")).toBeNull();

    expect(calls).toHaveLength(1);
    expect(lastSparqlFailure()?.kind).toBe("timeout");
    expect(sparqlCooldownUntil()).toBeGreaterThanOrEqual(before + 60_000);
  });

  it("fails fast (no request) while the source is cooling", async () => {
    fetchSequence(response(504));
    await runSparql("SELECT ?x WHERE {}");
    const calls = fetchSequence(response(200, { bindings: [{}] }));

    expect(await runSparql("SELECT ?x WHERE {}")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("honours a LONG Retry-After as a cool-down instead of sleeping inline", async () => {
    const calls = fetchSequence(response(429, { retryAfter: "120" }));
    const before = Date.now();

    expect(await runSparql("SELECT ?x WHERE {}")).toBeNull();

    expect(calls).toHaveLength(1);
    expect(lastSparqlFailure()).toMatchObject({ kind: "throttled", status: 429 });
    expect(sparqlCooldownUntil()).toBeGreaterThanOrEqual(before + 120_000);
  });

  it("waits out a SHORT Retry-After (floored at 5 s) and then retries once", async () => {
    vi.useFakeTimers();
    const calls = fetchSequence(
      response(429, { retryAfter: "1" }),
      response(200, { bindings: [{ x: { type: "literal", value: "ok" } }] }),
    );

    const pending = runSparql("SELECT ?x WHERE {}");
    await vi.advanceTimersByTimeAsync(4_900);
    expect(calls).toHaveLength(1); // still sleeping
    await vi.advanceTimersByTimeAsync(200);
    const rows = await pending;

    expect(rows).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(sparqlCooldownUntil()).toBe(0);
  });

  it("serialises concurrent callers through one in-flight query", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    globalThis.fetch = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return response(200, { bindings: [] });
    }) as unknown as typeof fetch;

    await Promise.all([runSparql("a"), runSparql("b"), runSparql("c")]);

    expect(maxInFlight).toBe(1);
  });
});

describe("source cool-down persistence (AdminWorkerMemory)", () => {
  function makePrisma(stored: { until?: number } | null) {
    const upsert = vi.fn(async () => ({}));
    return {
      prisma: {
        adminWorkerMemory: {
          findUnique: vi.fn(async () => (stored ? { memoryValue: stored } : null)),
          upsert,
        },
      } as unknown as PrismaClient,
      upsert,
    };
  }

  it("persists the transport's cool-down (capped) so the next pass / process skips the lane", async () => {
    fetchSequence(response(429, { retryAfter: String(60 * 60) })); // an hour
    await runSparql("SELECT ?x WHERE {}");
    const { prisma, upsert } = makePrisma(null);
    const before = Date.now();

    const until = await persistSourceCooldown(prisma);

    expect(until).not.toBeNull();
    expect(until!).toBeLessThanOrEqual(before + 15 * 60 * 1000 + 50); // capped at 15 min
    const arg = upsert.mock.calls[0][0] as {
      where: { memoryType_memoryKey: { memoryKey: string } };
      create: { memoryValue: { until: number; kind: string } };
    };
    expect(arg.where.memoryType_memoryKey.memoryKey).toBe(SOURCE_COOLDOWN_KEY);
    expect(arg.create.memoryValue.kind).toBe("throttled");
  });

  it("persists nothing when there is no cool-down to share", async () => {
    fetchSequence(new Error("ECONNRESET"));
    await runSparql("SELECT ?x WHERE {}");
    const { prisma, upsert } = makePrisma(null);
    expect(await persistSourceCooldown(prisma)).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("seeds a fresh process's gate from the persisted value (extend-only)", async () => {
    const until = Date.now() + 90_000;
    const { prisma } = makePrisma({ until });

    const remaining = await readSourceCooldownMs(prisma);

    expect(remaining).toBeGreaterThan(80_000);
    expect(sparqlCooldownUntil()).toBe(until);
    // A stale persisted value does not shorten / create a cool-down.
    resetSparqlGateForTests({ minSpacingMs: 0 });
    expect(await readSourceCooldownMs(makePrisma({ until: Date.now() - 1 }).prisma)).toBe(0);
  });
});
