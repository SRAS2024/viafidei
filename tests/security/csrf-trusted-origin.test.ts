import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { NextRequest as NextRequestType } from "next/server";
import { evaluateCsrf, assertCsrfOk } from "@/lib/security/csrf";
import { getPublicOrigin, getTrustedOrigins } from "@/lib/security/request";
import { middleware } from "@/middleware";
import { appConfig } from "@/lib/config";

// The deployment's real public origin, taken from the same place the app
// takes it — so this test cannot drift from configuration.
const CANONICAL = new URL(appConfig.canonicalUrl).origin;
const CANONICAL_WWW = `https://www.${new URL(appConfig.canonicalUrl).hostname}`;
const ATTACKER = "https://evil.example.com";

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string): void {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

afterEach(() => {
  setNodeEnv(originalNodeEnv ?? "test");
});

function req(args: {
  method?: string;
  url?: string;
  origin?: string;
  referer?: string;
  headers?: Record<string, string>;
}): NextRequestType {
  const headers = new Headers(args.headers ?? {});
  if (args.origin) headers.set("origin", args.origin);
  if (args.referer) headers.set("referer", args.referer);
  const url = args.url ?? `${CANONICAL}/api/admin/prayers`;
  const request = new Request(url, { method: args.method ?? "POST", headers });
  return Object.assign(request, { nextUrl: new URL(url) }) as unknown as NextRequestType;
}

describe("production CSRF — a forwarded host header cannot pick the trusted origin", () => {
  it("rejects an attacker Origin even when X-Forwarded-Host names the attacker", () => {
    // The whole attack: poison the forwarded host so the app compares the
    // forged Origin against itself. Before the fix this returned ok:true.
    setNodeEnv("production");
    const decision = evaluateCsrf(
      req({
        origin: ATTACKER,
        headers: {
          "x-forwarded-host": "evil.example.com",
          "x-forwarded-proto": "https",
          host: "evil.example.com",
        },
      }),
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toBe("cross_origin");
      // The security event must not report the attacker's host as "expected".
      expect(decision.expected).not.toContain("evil.example.com");
      expect(decision.expected).toContain(CANONICAL);
    }
  });

  it("rejects an attacker Referer with a poisoned Host header too", () => {
    setNodeEnv("production");
    const decision = evaluateCsrf(
      req({ referer: `${ATTACKER}/attack`, headers: { host: "evil.example.com" } }),
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("cross_origin");
  });

  it("still accepts the real canonical origin and its www sibling", () => {
    setNodeEnv("production");
    for (const origin of [CANONICAL, CANONICAL_WWW]) {
      expect(evaluateCsrf(req({ origin })).ok).toBe(true);
    }
  });

  it("still rejects a state-changing request with no Origin and no Referer", () => {
    setNodeEnv("production");
    const decision = evaluateCsrf(req({}));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("missing_origin");
  });

  it("still lets safe methods through", () => {
    setNodeEnv("production");
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(evaluateCsrf(req({ method })).ok).toBe(true);
    }
  });

  it("does not trust a loopback origin in production", () => {
    // Loopback is a development convenience; in production it would let a
    // co-hosted process on the box forge state-changing requests.
    setNodeEnv("production");
    expect(evaluateCsrf(req({ origin: "http://localhost:3000" })).ok).toBe(false);
  });

  it("assertCsrfOk still answers 403 with the csrf error shape", async () => {
    setNodeEnv("production");
    const res = assertCsrfOk(req({ origin: ATTACKER, headers: { host: "evil.example.com" } }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = (await res!.json()) as { error: string; reason: string };
    expect(body).toEqual({ error: "csrf", reason: "cross_origin" });
  });

  it("derives the trusted set from configuration, not from the request", () => {
    setNodeEnv("production");
    const trusted = getTrustedOrigins(
      req({ headers: { "x-forwarded-host": "evil.example.com", host: "evil.example.com" } }),
    );
    expect(trusted).toContain(CANONICAL);
    expect(trusted.join(" ")).not.toContain("evil.example.com");
  });
});

describe("development / test CSRF — local hosts keep working", () => {
  it("accepts the origin the request actually arrived on", () => {
    const url = "http://dev-box.local:4310/api/admin/prayers";
    expect(
      evaluateCsrf(
        req({
          url,
          origin: "http://dev-box.local:4310",
          headers: { host: "dev-box.local:4310" },
        }),
      ).ok,
    ).toBe(true);
  });

  it("accepts loopback on any port", () => {
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3100", "http://[::1]:5173"]) {
      expect(evaluateCsrf(req({ origin, headers: { host: "localhost:3000" } })).ok).toBe(true);
    }
  });

  it("still rejects a foreign origin outside production", () => {
    expect(evaluateCsrf(req({ origin: ATTACKER, headers: { host: "localhost:3000" } })).ok).toBe(
      false,
    );
  });
});

describe("public origin — a forged host cannot aim a redirect", () => {
  it("falls back to the canonical origin when production sees an unknown forwarded host", () => {
    setNodeEnv("production");
    const request = new Request("http://0.0.0.0:8080/api/auth/login", {
      headers: { "x-forwarded-host": "evil.example.com", "x-forwarded-proto": "https" },
    }) as unknown as NextRequestType;
    expect(getPublicOrigin(request)).toBe(CANONICAL);
  });

  it("falls back to the canonical origin when production sees an unknown Host header", () => {
    setNodeEnv("production");
    const request = new Request("http://0.0.0.0:8080/api/auth/login", {
      headers: { host: "evil.example.com" },
    }) as unknown as NextRequestType;
    expect(getPublicOrigin(request)).toBe(CANONICAL);
  });

  it("still honours the real production host", () => {
    setNodeEnv("production");
    const request = new Request("http://0.0.0.0:8080/x", {
      headers: { "x-forwarded-host": new URL(CANONICAL).hostname, "x-forwarded-proto": "https" },
    }) as unknown as NextRequestType;
    expect(getPublicOrigin(request)).toBe(CANONICAL);
  });

  it("middleware's /admin login redirect cannot be aimed off-site in production", () => {
    setNodeEnv("production");
    const res = middleware(
      new NextRequest(
        new Request("https://bind-host.internal/admin/users", {
          headers: { "x-forwarded-host": "evil.example.com", "x-forwarded-proto": "https" },
        }),
      ),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${CANONICAL}/admin/login`);
  });
});
