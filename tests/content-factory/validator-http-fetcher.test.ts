/**
 * Validator HTTP fetcher tests (spec §17).
 *
 * The fetcher must:
 *   - retry transient failures with exponential backoff
 *   - return null (not throw) when retries are exhausted
 *   - strip HTML tags before returning the body
 *   - cache per-URL bodies within a worker tick
 */

import { describe, expect, it, vi } from "vitest";
import {
  createValidatorDocumentLoader,
  fetchValidatorDocument,
} from "@/lib/content-factory/validator-http-fetcher";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html" },
  });
}

describe("fetchValidatorDocument()", () => {
  it("returns the parsed JSON body as raw text", async () => {
    const stub = vi.fn(async () => jsonResponse({ ok: true }));
    const result = await fetchValidatorDocument("https://x/y", {
      fetcher: stub as unknown as typeof fetch,
      maxAttempts: 1,
      baseDelayMs: 0,
    });
    expect(result?.body).toBe('{"ok":true}');
    expect(result?.contentType).toMatch(/json/);
  });

  it("strips HTML tags and decodes common entities from an HTML body", async () => {
    const stub = vi.fn(async () =>
      htmlResponse(
        "<html><head><title>X</title></head><body><h1>Our Father</h1><p>Hallowed be thy name &amp; Amen.</p></body></html>",
      ),
    );
    const result = await fetchValidatorDocument("https://x/y", {
      fetcher: stub as unknown as typeof fetch,
      maxAttempts: 1,
      baseDelayMs: 0,
    });
    expect(result?.body).not.toContain("<");
    expect(result?.body).toMatch(/Our Father/);
    expect(result?.body).toMatch(/Hallowed be thy name & Amen\./);
  });

  it("retries on transient failure and succeeds on a later attempt", async () => {
    let calls = 0;
    const stub = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("network error");
      return jsonResponse({ ok: true });
    });
    const result = await fetchValidatorDocument("https://x/y", {
      fetcher: stub as unknown as typeof fetch,
      maxAttempts: 5,
      baseDelayMs: 0,
    });
    expect(result?.body).toBe('{"ok":true}');
    expect(calls).toBe(3);
  });

  it("returns null after exhausting retries", async () => {
    const stub = vi.fn(async () => {
      throw new Error("dns error");
    });
    const result = await fetchValidatorDocument("https://x/y", {
      fetcher: stub as unknown as typeof fetch,
      maxAttempts: 2,
      baseDelayMs: 0,
    });
    expect(result).toBeNull();
  });

  it("returns null on a non-2xx response", async () => {
    const stub = vi.fn(async () => htmlResponse("not found", 404));
    const result = await fetchValidatorDocument("https://x/y", {
      fetcher: stub as unknown as typeof fetch,
      maxAttempts: 1,
      baseDelayMs: 0,
    });
    expect(result).toBeNull();
  });
});

describe("createValidatorDocumentLoader()", () => {
  it("caches the body for the lifetime of one loader instance", async () => {
    let calls = 0;
    const stub = vi.fn(async () => {
      calls += 1;
      return htmlResponse("<p>cached body</p>");
    });
    const loader = createValidatorDocumentLoader({
      fetcher: stub as unknown as typeof fetch,
      maxAttempts: 1,
      baseDelayMs: 0,
    });
    const a = await loader("https://x/y");
    const b = await loader("https://x/y");
    expect(a?.body).toBe("cached body");
    expect(b?.body).toBe("cached body");
    // Only one network call despite two loader invocations.
    expect(calls).toBe(1);
  });

  it("returns null when the underlying fetch is unreachable", async () => {
    const stub = vi.fn(async () => {
      throw new Error("unreachable");
    });
    const loader = createValidatorDocumentLoader({
      fetcher: stub as unknown as typeof fetch,
      maxAttempts: 1,
      baseDelayMs: 0,
    });
    const result = await loader("https://offline/x");
    expect(result).toBeNull();
  });
});
