import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { REQUEST_ID_HEADER } from "@/lib/observability";

function makeRequest(url = "https://app.example.com/", headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { headers }));
}

describe("middleware", () => {
  it("propagates a well-formed incoming X-Request-Id verbatim", () => {
    const incoming = "abcDEF12_-345678";
    const res = middleware(makeRequest("https://x/", { [REQUEST_ID_HEADER]: incoming }));
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(incoming);
  });

  it("generates a new X-Request-Id when none is provided", () => {
    const res = middleware(makeRequest("https://x/"));
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).toBeTruthy();
    expect(id!).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });

  it("regenerates the X-Request-Id when the incoming header is malformed", () => {
    const res = middleware(makeRequest("https://x/", { [REQUEST_ID_HEADER]: "bad value!!" }));
    const id = res.headers.get(REQUEST_ID_HEADER)!;
    expect(id).not.toBe("bad value!!");
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });

  it("sets the full set of security response headers", () => {
    const res = middleware(makeRequest());
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");

    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("does not set HSTS outside production", () => {
    const original = process.env.NODE_ENV;
    // tests/setup.ts pins NODE_ENV to "test"; sanity-check and assert HSTS off.
    expect(original).not.toBe("production");
    const res = middleware(makeRequest());
    expect(res.headers.get("Strict-Transport-Security")).toBeNull();
  });
});
