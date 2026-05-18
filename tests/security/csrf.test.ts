import { describe, expect, it } from "vitest";
import { evaluateCsrf, assertCsrfOk } from "@/lib/security/csrf";
import type { NextRequest } from "next/server";

function buildReq(args: {
  method?: string;
  origin?: string | null;
  referer?: string | null;
  host?: string;
  proto?: string;
}): NextRequest {
  const headers = new Headers();
  if (args.origin) headers.set("origin", args.origin);
  if (args.referer) headers.set("referer", args.referer);
  if (args.host) headers.set("host", args.host);
  if (args.proto) headers.set("x-forwarded-proto", args.proto);
  if (args.host) headers.set("x-forwarded-host", args.host);
  // NextRequest is structurally compatible with Request for the
  // surface the CSRF helper uses (headers, method, nextUrl).
  const url = `${args.proto ?? "https"}://${args.host ?? "viafidei.example.com"}/api/admin/prayers`;
  const req = new Request(url, { method: args.method ?? "POST", headers });
  return Object.assign(req, {
    nextUrl: new URL(url),
  }) as unknown as NextRequest;
}

describe("evaluateCsrf — same-origin mutation requests pass", () => {
  it("safe methods (GET/HEAD/OPTIONS) always pass without an Origin header", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const d = evaluateCsrf(buildReq({ method, host: "viafidei.example.com", proto: "https" }));
      expect(d.ok).toBe(true);
    }
  });

  it("POST with same Origin passes", () => {
    const d = evaluateCsrf(
      buildReq({
        method: "POST",
        origin: "https://viafidei.example.com",
        host: "viafidei.example.com",
        proto: "https",
      }),
    );
    expect(d.ok).toBe(true);
  });

  it("POST with same-origin Referer (no Origin) passes", () => {
    const d = evaluateCsrf(
      buildReq({
        method: "POST",
        referer: "https://viafidei.example.com/admin/prayers",
        host: "viafidei.example.com",
        proto: "https",
      }),
    );
    expect(d.ok).toBe(true);
  });
});

describe("evaluateCsrf — cross-origin mutation requests fail", () => {
  it("POST with a foreign Origin is rejected", () => {
    const d = evaluateCsrf(
      buildReq({
        method: "POST",
        origin: "https://evil.example.com",
        host: "viafidei.example.com",
        proto: "https",
      }),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("cross_origin");
  });

  it("POST with no Origin AND no Referer is rejected", () => {
    const d = evaluateCsrf(
      buildReq({
        method: "POST",
        host: "viafidei.example.com",
        proto: "https",
      }),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("missing_origin");
  });

  it("POST with a foreign Referer is rejected", () => {
    const d = evaluateCsrf(
      buildReq({
        method: "POST",
        referer: "https://evil.example.com/attack",
        host: "viafidei.example.com",
        proto: "https",
      }),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("cross_origin");
  });
});

describe("assertCsrfOk — returns 403 on cross-origin, null on same-origin", () => {
  it("returns null when the request is safe", () => {
    expect(
      assertCsrfOk(
        buildReq({
          method: "POST",
          origin: "https://viafidei.example.com",
          host: "viafidei.example.com",
          proto: "https",
        }),
      ),
    ).toBeNull();
  });

  it("returns a 403 Response when cross-origin", async () => {
    const res = assertCsrfOk(
      buildReq({
        method: "POST",
        origin: "https://evil.example.com",
        host: "viafidei.example.com",
        proto: "https",
      }),
    );
    expect(res).not.toBeNull();
    if (res) {
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string; reason: string };
      expect(body.error).toBe("csrf");
      expect(body.reason).toBe("cross_origin");
    }
  });
});
