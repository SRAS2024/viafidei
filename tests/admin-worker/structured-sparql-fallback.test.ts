/**
 * SPARQL endpoint fallback. The canonical Wikidata Query Service
 * (query.wikidata.org) is often blocked/rate-limited on cloud hosts, which
 * starves structured ingest. WIKIDATA_SPARQL_ENDPOINTS lets the operator add a
 * reachable fallback; runSparql must fail over to it when the primary is
 * unreachable, and accept a reachable endpoint's answer even if empty.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runSparql } from "@/lib/admin-worker/structured/wikidata";

const realFetch = globalThis.fetch;
let savedEndpoints: string | undefined;
let savedSkip: string | undefined;

beforeEach(() => {
  savedEndpoints = process.env.WIKIDATA_SPARQL_ENDPOINTS;
  savedSkip = process.env.ADMIN_WORKER_SKIP_NETWORK;
  delete process.env.ADMIN_WORKER_SKIP_NETWORK; // network path enabled for these tests
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedEndpoints === undefined) delete process.env.WIKIDATA_SPARQL_ENDPOINTS;
  else process.env.WIKIDATA_SPARQL_ENDPOINTS = savedEndpoints;
  if (savedSkip === undefined) delete process.env.ADMIN_WORKER_SKIP_NETWORK;
  else process.env.ADMIN_WORKER_SKIP_NETWORK = savedSkip;
});

function jsonResponse(bindings: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/sparql-results+json" },
    json: async () => ({ results: { bindings } }),
    text: async () => JSON.stringify({ results: { bindings } }),
  } as unknown as Response;
}

describe("runSparql endpoint fallback", () => {
  it("fails over to a reachable WIKIDATA_SPARQL_ENDPOINTS host when the primary is blocked", async () => {
    process.env.WIKIDATA_SPARQL_ENDPOINTS = "https://mirror.example/sparql";
    const hits: string[] = [];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      hits.push(u);
      if (u.includes("query.wikidata.org")) throw new Error("blocked (cloud IP)"); // primary unreachable
      return jsonResponse([{ x: { type: "literal", value: "ok" } }]); // mirror reachable
    }) as unknown as typeof fetch;

    const rows = await runSparql("SELECT ?x WHERE {}");
    expect(rows).toHaveLength(1);
    expect(hits.some((u) => u.includes("query.wikidata.org"))).toBe(true); // primary tried first
    expect(hits.some((u) => u.includes("mirror.example"))).toBe(true); // then the fallback
  });

  it("accepts the primary's answer (even empty) without hitting the fallback when reachable", async () => {
    process.env.WIKIDATA_SPARQL_ENDPOINTS = "https://mirror.example/sparql";
    const hits: string[] = [];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      hits.push(String(url));
      return jsonResponse([]); // reachable, legitimately empty
    }) as unknown as typeof fetch;

    const rows = await runSparql("SELECT ?x WHERE {}");
    expect(rows).toEqual([]);
    expect(hits.some((u) => u.includes("query.wikidata.org"))).toBe(true);
    expect(hits.some((u) => u.includes("mirror.example"))).toBe(false); // not retried on empty
  });
});
