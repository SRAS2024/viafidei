import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { getPublicOrigin, redirectTo } from "@/lib/security/request";

beforeEach(() => {
  // The fallback proto is "https" in production, "http" otherwise. Pin
  // production for the assertions below; the dev fallback is exercised in
  // its own test.
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeReq({
  url,
  forwardedHost,
  forwardedProto,
  host,
}: {
  url: string;
  forwardedHost?: string;
  forwardedProto?: string;
  host?: string;
}): NextRequest {
  const headers = new Headers();
  if (forwardedHost) headers.set("x-forwarded-host", forwardedHost);
  if (forwardedProto) headers.set("x-forwarded-proto", forwardedProto);
  if (host) headers.set("host", host);
  return new Request(url, { headers }) as unknown as NextRequest;
}

describe("getPublicOrigin", () => {
  it("uses X-Forwarded-Host + X-Forwarded-Proto when both are set", () => {
    const req = makeReq({
      url: "http://0.0.0.0:8080/api/auth/login",
      forwardedHost: "etviafidei.com",
      forwardedProto: "https",
    });
    expect(getPublicOrigin(req)).toBe("https://etviafidei.com");
  });

  it("only takes the first comma-separated proto when multiple proxies forwarded it", () => {
    const req = makeReq({
      url: "http://0.0.0.0:8080/x",
      forwardedHost: "etviafidei.com",
      forwardedProto: "https, http",
    });
    expect(getPublicOrigin(req)).toBe("https://etviafidei.com");
  });

  it("falls back to the Host header when X-Forwarded-Host is missing", () => {
    const req = makeReq({
      url: "http://0.0.0.0:8080/api/x",
      host: "etviafidei.com",
    });
    expect(getPublicOrigin(req)).toBe("https://etviafidei.com");
  });

  it("ignores X-Forwarded-Host that names a local-bind address", () => {
    // A misconfigured proxy that echoes the upstream socket back as the
    // forwarded host would otherwise re-introduce the 0.0.0.0:8080 bug.
    const req = makeReq({
      url: "http://0.0.0.0:8080/api/x",
      forwardedHost: "0.0.0.0:8080",
      forwardedProto: "https",
      host: "etviafidei.com",
    });
    expect(getPublicOrigin(req)).toBe("https://etviafidei.com");
  });

  it("never returns a local-bind hostname when any header has a real one", () => {
    for (const localHost of ["0.0.0.0:8080", "127.0.0.1:3000", "localhost:8080", "[::1]"]) {
      const req = makeReq({
        url: `http://${localHost}/api/x`,
        host: "etviafidei.com",
      });
      expect(getPublicOrigin(req)).toBe("https://etviafidei.com");
    }
  });

  it("falls back to req.url only when nothing else is available (no proxy)", () => {
    const req = makeReq({ url: "http://localhost:3000/api/x" });
    // No forwarded host, no host header that beats the local-bind check —
    // last resort is req.url so dev-server requests still work.
    expect(getPublicOrigin(req)).toBe("http://localhost:3000");
  });

  it("uses http fallback when not in production (Host header present, no X-Forwarded-Proto)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const req = makeReq({ url: "http://localhost:3000/x", host: "etviafidei.com" });
    expect(getPublicOrigin(req)).toBe("http://etviafidei.com");
  });

  it("strips the upstream port from the host when promoting to HTTPS", () => {
    // Misconfigured proxies sometimes pass through the upstream service
    // port in Host or X-Forwarded-Host. Browsers reject HTTPS URLs that
    // point at non-standard ports (Safari ERR 103, Chrome ERR_UNSAFE_PORT),
    // so the helper must strip 8080 / 3000 / etc. when the scheme is https.
    const req = makeReq({
      url: "http://etviafidei.com:8080/x",
      host: "etviafidei.com:8080",
    });
    expect(getPublicOrigin(req)).toBe("https://etviafidei.com");
  });

  it("preserves explicit port 443 on HTTPS (no-op)", () => {
    const req = makeReq({
      url: "http://x/y",
      forwardedHost: "etviafidei.com:443",
      forwardedProto: "https",
    });
    expect(getPublicOrigin(req)).toBe("https://etviafidei.com:443");
  });

  it("preserves the dev port on HTTP (no scheme upgrade)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const req = makeReq({ url: "http://localhost:3000/x", host: "localhost:3000" });
    // Localhost host header is ignored as a local-bind; falls through to
    // req.url, which retains :3000 because the dev server actually listens
    // there. The ports we strip are only the *upstream* ones that should
    // never appear in a public HTTPS URL.
    expect(getPublicOrigin(req)).toBe("http://localhost:3000");
  });
});

describe("redirectTo", () => {
  it("issues a 303 to the public origin, not the locally-bound socket", () => {
    const req = makeReq({
      url: "http://0.0.0.0:8080/api/auth/login",
      forwardedHost: "etviafidei.com",
      forwardedProto: "https",
    });
    const res = redirectTo(req, "/login?error=invalid");
    expect(res.status).toBe(303);
    // Without the public-origin fix, this would be
    // "https://0.0.0.0:8080/login?error=invalid" — Safari rejects port 8080
    // over HTTPS and surfaces "Not allowed to use restricted network port"
    // (WebKitErrorDomain:103), which is the user-reported bug.
    expect(res.headers.get("location")).toBe("https://etviafidei.com/login?error=invalid");
  });

  it("supports a custom redirect status", () => {
    const req = makeReq({
      url: "http://x/y",
      forwardedHost: "etviafidei.com",
      forwardedProto: "https",
    });
    const res = redirectTo(req, "/profile", 302);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://etviafidei.com/profile");
  });
});
