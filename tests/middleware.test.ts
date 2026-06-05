import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware, DEVICE_CREDENTIAL_COOKIE } from "@/middleware";
import { REQUEST_ID_HEADER } from "@/lib/observability";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

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

  it("sets a 2-year preload HSTS header in production", () => {
    const original = process.env.NODE_ENV;
    // NODE_ENV is a readonly type but writable at runtime; cast to set it.
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    try {
      const hsts = middleware(makeRequest()).headers.get("Strict-Transport-Security");
      expect(hsts).toBe("max-age=63072000; includeSubDomains; preload");
    } finally {
      (process.env as { NODE_ENV?: string }).NODE_ENV = original;
    }
  });

  // The login redirect builds its absolute URL from publicOriginForMiddleware,
  // which mirrors getPublicOrigin: prefer X-Forwarded-Host/Proto, fall back to
  // the Host header, never echo a local-bind host, and strip a redundant
  // upstream port over https (the Safari "restricted network port" bug).
  describe("public origin resolution (via the admin login redirect)", () => {
    function redirectLocation(headers: Record<string, string>): string {
      // A bare hostname URL with no path segment maps to "/", so use an
      // unauthenticated protected admin path to force the redirect.
      const res = middleware(makeRequest("https://bind-host.internal/admin/users", headers));
      expect(res.status).toBe(303);
      return res.headers.get("location") ?? "";
    }

    it("prefers X-Forwarded-Host with X-Forwarded-Proto", () => {
      expect(
        redirectLocation({ "x-forwarded-host": "viafidei.org", "x-forwarded-proto": "https" }),
      ).toBe("https://viafidei.org/admin/login");
    });

    it("defaults the proto to https when only X-Forwarded-Host is present", () => {
      expect(redirectLocation({ "x-forwarded-host": "viafidei.org" })).toBe(
        "https://viafidei.org/admin/login",
      );
    });

    it("takes only the first value of a comma-joined X-Forwarded-Proto", () => {
      expect(
        redirectLocation({
          "x-forwarded-host": "viafidei.org",
          "x-forwarded-proto": "https, http",
        }),
      ).toBe("https://viafidei.org/admin/login");
    });

    it("strips a redundant upstream port from the forwarded host over https", () => {
      expect(
        redirectLocation({ "x-forwarded-host": "viafidei.org:8080", "x-forwarded-proto": "https" }),
      ).toBe("https://viafidei.org/admin/login");
    });

    it("leaves an explicit :443 in place (URL() then normalizes the default port away)", () => {
      // stripUpstreamPort keeps :443 (it is the https default, not a redundant
      // upstream port); the WHATWG URL constructor then drops the default port,
      // so the emitted Location has no :443. Either way the host is preserved.
      expect(
        redirectLocation({ "x-forwarded-host": "viafidei.org:443", "x-forwarded-proto": "https" }),
      ).toBe("https://viafidei.org/admin/login");
    });

    it("does not strip the port for a bracketed IPv6 forwarded host", () => {
      expect(
        redirectLocation({ "x-forwarded-host": "[2001:db8::1]", "x-forwarded-proto": "https" }),
      ).toBe("https://[2001:db8::1]/admin/login");
    });

    it("ignores a local-bind X-Forwarded-Host and falls back to the Host header", () => {
      expect(redirectLocation({ "x-forwarded-host": "0.0.0.0:8080", host: "viafidei.org" })).toBe(
        "http://viafidei.org/admin/login",
      );
    });

    it("uses the Host header (non-prod => http) when no forwarded header is present", () => {
      expect(redirectLocation({ host: "viafidei.org" })).toBe("http://viafidei.org/admin/login");
    });

    it("does not strip the port from the Host header when the scheme is http", () => {
      expect(redirectLocation({ host: "viafidei.org:8080" })).toBe(
        "http://viafidei.org:8080/admin/login",
      );
    });

    it("ignores a local-bind Host header and falls back to the request origin", () => {
      // Both candidates are local-bind, so neither is echoed; the redirect
      // uses req.nextUrl.origin (the request URL's own host) instead.
      expect(redirectLocation({ host: "127.0.0.1:3000" })).toBe(
        "https://bind-host.internal/admin/login",
      );
    });
  });

  describe("admin protection", () => {
    it("redirects unauthenticated /admin requests to /admin/login", () => {
      const res = middleware(makeRequest("https://app.example.com/admin"));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("https://app.example.com/admin/login");
    });

    it("redirects unauthenticated /admin/users requests to /admin/login", () => {
      const res = middleware(makeRequest("https://app.example.com/admin/users"));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("https://app.example.com/admin/login");
    });

    it("does NOT redirect /admin/login itself (it must be reachable to sign in)", () => {
      const res = middleware(makeRequest("https://app.example.com/admin/login"));
      // 303 indicates a redirect; plain `next()` returns 200.
      expect(res.status).not.toBe(303);
    });

    it("does NOT redirect /api/admin/login (the form-post target)", () => {
      const res = middleware(makeRequest("https://app.example.com/api/admin/login"));
      expect(res.status).not.toBe(303);
    });

    it("does NOT redirect /api/admin/logout", () => {
      const res = middleware(makeRequest("https://app.example.com/api/admin/logout"));
      expect(res.status).not.toBe(303);
    });

    it("lets requests with a session cookie through to the page (which calls requireAdmin)", () => {
      const res = middleware(
        makeRequest("https://app.example.com/admin", {
          cookie: `${SESSION_COOKIE_NAME}=opaque-iron-session-blob`,
        }),
      );
      expect(res.status).not.toBe(303);
    });

    it("does NOT redirect non-admin paths even with no cookie", () => {
      const res = middleware(makeRequest("https://app.example.com/prayers"));
      expect(res.status).not.toBe(303);
    });
  });

  describe("device-credential cookie (spec: server-issued, opaque, HMAC-fingerprinted only)", () => {
    it("uses 'vf_dev_id' as the cookie name", () => {
      expect(DEVICE_CREDENTIAL_COOKIE).toBe("vf_dev_id");
    });

    it("sets the device-credential cookie when none is present", () => {
      const res = middleware(makeRequest("https://app.example.com/"));
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain(`${DEVICE_CREDENTIAL_COOKIE}=`);
    });

    it("device-credential cookie is HttpOnly + SameSite=Lax + Path=/", () => {
      const res = middleware(makeRequest("https://app.example.com/"));
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).toMatch(/Path=\//);
    });

    it("device-credential cookie value is at least 32 chars (opaque random)", () => {
      const res = middleware(makeRequest("https://app.example.com/"));
      const setCookie = res.headers.get("set-cookie") ?? "";
      const m = setCookie.match(new RegExp(`${DEVICE_CREDENTIAL_COOKIE}=([^;]+)`));
      expect(m).not.toBeNull();
      expect(m![1]!.length).toBeGreaterThanOrEqual(32);
    });

    it("does NOT reissue the cookie when a valid one is already present", () => {
      const existing = "a".repeat(64);
      const res = middleware(
        makeRequest("https://app.example.com/", {
          cookie: `${DEVICE_CREDENTIAL_COOKIE}=${existing}`,
        }),
      );
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).not.toContain(`${DEVICE_CREDENTIAL_COOKIE}=`);
    });

    it("DOES reissue when the existing cookie is too short (compromised / truncated)", () => {
      const res = middleware(
        makeRequest("https://app.example.com/", {
          cookie: `${DEVICE_CREDENTIAL_COOKIE}=short`,
        }),
      );
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain(`${DEVICE_CREDENTIAL_COOKIE}=`);
    });
  });
});
