/**
 * Fetcher transport-resilience (developer-audit "Fetcher: transport is failing
 * on approved hosts" fix). A rate-limited approved host returns 429; the fetcher
 * must RETRY it (429 is "slow down", not a deterministic client error) and
 * honor Retry-After, rather than failing the fetch on the first 429 — which
 * previously tanked the transport-health rating whenever an authority host
 * throttled the worker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => {
  const approved = (host: string) => ["www.vatican.va", "vatican.va"].includes(host);
  return { isApprovedAuthorityHost: vi.fn(approved), isFetchableHost: vi.fn(approved) };
});
vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/logs", () => ({ writeAdminWorkerLog: vi.fn(async () => undefined) }));

import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";

const GOOD_HTML =
  "<html><head><title>Doc</title></head><body><h1>On Prayer</h1>" +
  "<p>".concat(
    "The Church teaches that prayer is the raising of the mind and heart to God. ".repeat(8),
  ) +
  "</p><p>It is a vital and personal relationship with the living and true God.</p></body></html>";

function makeResponse(
  status: number,
  opts: { body?: string; headers?: Record<string, string> } = {},
) {
  const h = new Map(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    url: "https://www.vatican.va/x",
    headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null },
    text: async () => opts.body ?? "",
    arrayBuffer: async () => new TextEncoder().encode(opts.body ?? "").buffer,
  };
}

function makePrisma() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    prisma: {
      adminWorkerFetchResult: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          const row = { id: `f${rows.length}`, ...args.data };
          rows.push(row);
          return row;
        }),
      },
    } as unknown as Parameters<typeof adminWorkerFetch>[0],
  };
}

const ENV = [
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_FETCH_HOST_PACE_MS",
  "ADMIN_WORKER_DYNAMIC_FETCHER",
  "ADMIN_WORKER_ARCHIVE_FALLBACK",
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV) saved[k] = process.env[k];
  delete process.env.ADMIN_WORKER_SKIP_NETWORK; // exercise the real fetch path
  process.env.ADMIN_WORKER_FETCH_HOST_PACE_MS = "0"; // no pacing delay in tests
  process.env.ADMIN_WORKER_DYNAMIC_FETCHER = "0"; // no headless render
  process.env.ADMIN_WORKER_ARCHIVE_FALLBACK = "0"; // no Wayback second fetch
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("adminWorkerFetch transport resilience", () => {
  it("retries a 429 (honoring Retry-After) and succeeds on the next attempt", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return makeResponse(429, { headers: { "retry-after": "0" } });
      return makeResponse(200, { body: GOOD_HTML, headers: { "content-type": "text/html" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { prisma } = makePrisma();
    const result = await adminWorkerFetch(prisma, { url: "https://www.vatican.va/x" });

    expect(calls).toBe(2); // 429 did not end the fetch — it was retried
    expect(result.succeeded).toBe(true);
    expect(result.httpStatus).toBe(200);
  });

  it("does NOT retry a deterministic 404", async () => {
    const fetchMock = vi.fn(async () => makeResponse(404));
    vi.stubGlobal("fetch", fetchMock);

    const { prisma } = makePrisma();
    const result = await adminWorkerFetch(prisma, {
      url: "https://www.vatican.va/missing",
      // archive rescue is fail-open/offline here; result stays a failure
    });

    expect(fetchMock).toHaveBeenCalledTimes(1); // 4xx (non-429) is deterministic
    expect(result.succeeded).toBe(false);
  });
});
