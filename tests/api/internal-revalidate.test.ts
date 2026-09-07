/**
 * POST /api/internal/revalidate — the cache flush the Admin Worker can
 * actually reach.
 *
 * The worker runs as a separate process (usually on the operator's Mac), so
 * its `revalidateTag()` calls never touched the web server's caches. It now
 * POSTs here after a publish. The route is security-relevant (it is an
 * unauthenticated URL until a secret is configured), so the auth cases are
 * pinned as hard as the behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

import { MEMO_TTL, memo, memoClear, memoStats } from "@/lib/cache/memo";
import { POST } from "@/app/api/internal/revalidate/route";

const SESSION_SECRET = "test-session-secret-must-be-32-chars-long";

function request(token: string | null, body: unknown = { tags: ["content-type:Saint"] }) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/api/internal/revalidate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  memoClear();
  process.env.SESSION_SECRET = SESSION_SECRET;
  delete process.env.INTERNAL_API_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.INTERNAL_API_SECRET;
});

describe("authorisation", () => {
  it("refuses a request with no bearer at all", async () => {
    const res = await POST(request(null));
    expect(res.status).toBe(401);
  });

  it("refuses a wrong bearer", async () => {
    process.env.INTERNAL_API_SECRET = "the-real-secret";
    const res = await POST(request("not-the-secret"));
    expect(res.status).toBe(401);
  });

  it("refuses a bearer of a different length (the timing-safe path)", async () => {
    process.env.INTERNAL_API_SECRET = "the-real-secret";
    const res = await POST(request("x"));
    expect(res.status).toBe(401);
  });

  it("accepts the explicit INTERNAL_API_SECRET", async () => {
    process.env.INTERNAL_API_SECRET = "the-real-secret";
    const res = await POST(request("the-real-secret"));
    expect(res.status).toBe(200);
  });

  it("accepts the SESSION_SECRET-derived token when no explicit secret is set", async () => {
    const { deriveCronSecret } = await import("@/lib/security/cron-auth");
    const token = await deriveCronSecret();
    expect(token).toBeTruthy();
    const res = await POST(request(token));
    expect(res.status).toBe(200);
  });

  it("is closed by default — no secret configured means nothing is accepted", async () => {
    delete process.env.SESSION_SECRET;
    const res = await POST(request("anything"));
    expect(res.status).toBe(401);
    process.env.SESSION_SECRET = SESSION_SECRET;
  });
});

describe("flush behaviour", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "the-real-secret";
  });

  it("drops the in-process memo so a just-published row is visible immediately", async () => {
    await memo("subtype-counts:SAINT", MEMO_TTL.list, async () => ({ martyr: 1 }));
    await memo("saints-feast:01-21", MEMO_TTL.daily, async () => []);
    expect(memoStats().size).toBe(2);

    const res = await POST(request("the-real-secret", { tags: ["content-type:Saint"] }));
    const body = (await res.json()) as { ok: boolean; cleared: number; remaining: number };
    expect(body.ok).toBe(true);
    expect(body.cleared).toBe(2);
    expect(body.remaining).toBe(0);
  });

  it("clears only the sitemap keys when the sitemap tag is the only tag", async () => {
    await memo("sitemap:index", MEMO_TTL.sitemap, async () => []);
    await memo("subtype-counts:SAINT", MEMO_TTL.list, async () => ({}));
    const res = await POST(request("the-real-secret", { tags: ["sitemap"] }));
    const body = (await res.json()) as { cleared: number };
    expect(body.cleared).toBe(1);
    expect(memoStats().keys).toEqual(["subtype-counts:SAINT"]);
  });

  it("treats a malformed body as 'flush everything' rather than failing", async () => {
    await memo("subtype-counts:SAINT", MEMO_TTL.list, async () => ({}));
    const res = await POST(
      new Request("http://localhost/api/internal/revalidate", {
        method: "POST",
        headers: { authorization: "Bearer the-real-secret" },
        body: "not json",
      }) as unknown as NextRequest,
    );
    expect(res.status).toBe(200);
    expect(memoStats().size).toBe(0);
  });
});
