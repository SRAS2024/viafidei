import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// The exact pattern Next.js uses to pull the nonce back out of the CSP
// header (next/dist/server/app-render/get-script-nonce-from-header.js). If
// our nonce stops matching it, Next silently renders its inline scripts
// WITHOUT a nonce and the strict policy blocks hydration — so pin it here
// rather than trusting that "some random string" is good enough.
const NEXT_CSP_NONCE_SOURCE = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/;

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string): void {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

afterEach(() => {
  setNodeEnv(originalNodeEnv ?? "test");
});

function responseFor(url = "https://etviafidei.com/prayers"): ReturnType<typeof middleware> {
  return middleware(new NextRequest(new Request(url)));
}

function cspOf(url?: string): string {
  return responseFor(url).headers.get("Content-Security-Policy") ?? "";
}

/** Return one directive ("script-src 'self' …") from a policy string. */
function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ?? "";
}

describe("production CSP — script-src is nonce-based, never 'unsafe-inline'", () => {
  it("contains no 'unsafe-inline' anywhere in script-src", () => {
    setNodeEnv("production");
    const scriptSrc = directive(cspOf(), "script-src");
    expect(scriptSrc).not.toBe("");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("contains no 'unsafe-eval' in production either (dev-only concession)", () => {
    setNodeEnv("production");
    expect(directive(cspOf(), "script-src")).not.toContain("'unsafe-eval'");
  });

  it("does not fall back to a default-src that would allow inline script", () => {
    setNodeEnv("production");
    const csp = cspOf();
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(csp).not.toContain("'unsafe-inline' 'unsafe-eval'");
  });

  it("carries a nonce in the exact source form Next.js parses", () => {
    setNodeEnv("production");
    const sources = directive(cspOf(), "script-src").split(/\s+/).slice(1);
    const nonceSources = sources.filter((source) => NEXT_CSP_NONCE_SOURCE.test(source));
    expect(nonceSources).toHaveLength(1);
    // 16 random bytes -> 24 base64 characters including the padding.
    const value = NEXT_CSP_NONCE_SOURCE.exec(nonceSources[0]!)![1]!;
    expect(value.length).toBeGreaterThanOrEqual(22);
  });

  it("issues a DIFFERENT nonce on every request (a reused nonce is no nonce)", () => {
    setNodeEnv("production");
    const nonces = new Set(
      Array.from({ length: 25 }, () => directive(cspOf(), "script-src").match(/'nonce-[^']+'/)![0]),
    );
    expect(nonces.size).toBe(25);
  });

  it("hands the renderer the same policy on the request headers", () => {
    // Next reads the nonce from the REQUEST's content-security-policy header
    // during app render. NextResponse.next({ request: { headers } }) encodes
    // those overrides as x-middleware-request-* on the returned response.
    setNodeEnv("production");
    const res = responseFor();
    const forRenderer = res.headers.get("x-middleware-request-content-security-policy");
    expect(forRenderer).toBe(res.headers.get("Content-Security-Policy"));
    expect(res.headers.get("x-middleware-override-headers")).toContain("content-security-policy");
  });

  it("adds object-src 'none' (plugins/embeds are never used by this app)", () => {
    setNodeEnv("production");
    expect(directive(cspOf(), "object-src")).toBe("object-src 'none'");
  });
});

describe("CSP — the existing directives all survive", () => {
  it("retains frame-ancestors, base-uri and form-action", () => {
    const csp = cspOf();
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
  });

  it("retains the image, font, style and connect allowances the site needs", () => {
    const csp = cspOf();
    expect(directive(csp, "img-src")).toBe(
      "img-src 'self' data: https://res.cloudinary.com https://images.unsplash.com",
    );
    expect(directive(csp, "font-src")).toBe("font-src 'self' https://fonts.gstatic.com data:");
    expect(directive(csp, "style-src")).toBe(
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
  });
});

describe("CSP — the other security headers are untouched", () => {
  it("keeps frame protection, nosniff, referrer policy and permissions policy", () => {
    const res = responseFor();
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("keeps the 2-year preload HSTS header in production", () => {
    setNodeEnv("production");
    expect(responseFor().headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });
});

describe("CSP — development keeps webpack's eval-based module wrapper working", () => {
  it("allows 'unsafe-eval' outside production, but still no 'unsafe-inline'", () => {
    setNodeEnv("development");
    const scriptSrc = directive(cspOf(), "script-src");
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});
