import { describe, expect, it } from "vitest";
import { REDACTED, redactDetails, redactString, redactValue } from "@/lib/diagnostics/redaction";

describe("redactString — embedded secrets in free text", () => {
  it("redacts full database / connection URLs", () => {
    const out = redactString("connect failed: postgres://admin:hunter2@db.internal:5432/app");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("db.internal");
    expect(out).toContain("postgres://[redacted]");
  });

  it("redacts Authorization headers", () => {
    const out = redactString("Authorization: Bearer abcdef123456ABCDEF");
    expect(out).not.toContain("abcdef123456ABCDEF");
    expect(out).toContain("[redacted]");
  });

  it("redacts a bare Bearer token", () => {
    expect(redactString("sent Bearer abcdef123456ABCDEF upstream")).toBe(
      "sent Bearer [redacted] upstream",
    );
  });

  it("redacts JSON web tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.s3cr3tSignature";
    expect(redactString(`token=${jwt}`)).not.toContain("s3cr3tSignature");
  });

  it("redacts provider API key prefixes", () => {
    expect(redactString("using re_aB12cd34Ef56gh78")).not.toContain("re_aB12cd34Ef56gh78");
  });

  it("redacts inline secret assignments", () => {
    expect(redactString("password=SuperSecret99")).not.toContain("SuperSecret99");
  });

  it("leaves non-secret diagnostic text untouched", () => {
    const text = "status=failed route=/api/admin/login jobKind=source_fetch host=vatican.va";
    expect(redactString(text)).toBe(text);
  });
});

describe("redactValue — structured payloads", () => {
  it("redacts the value of a sensitive key", () => {
    const out = redactValue({ apiKey: "live-key-aaaa", sessionSecret: "shhh" }) as Record<
      string,
      unknown
    >;
    expect(out.apiKey).toBe(REDACTED);
    expect(out.sessionSecret).toBe(REDACTED);
  });

  it("keeps non-secret diagnostics — status, route, host, counts", () => {
    const input = {
      status: "failed",
      route: "/api/admin/diagnostics",
      sourceHost: "vatican.va",
      jobKind: "source_fetch",
      workerId: "worker-1",
      failedCount: 4,
      errorType: "timeout",
    };
    expect(redactValue(input)).toEqual(input);
  });

  it("never redacts booleans or numbers", () => {
    const out = redactValue({ tokenIssued: true, failed: 0 }) as Record<string, unknown>;
    expect(out.tokenIssued).toBe(true);
    expect(out.failed).toBe(0);
  });

  it("keeps one-way hashes and identifiers (safe key suffixes)", () => {
    const out = redactValue({
      deviceCredentialHash: "abc123hash",
      ipHash: "ffee00",
      securityEventId: "evt-1",
    }) as Record<string, unknown>;
    expect(out.deviceCredentialHash).toBe("abc123hash");
    expect(out.ipHash).toBe("ffee00");
    expect(out.securityEventId).toBe("evt-1");
  });

  it("recurses into nested objects and arrays", () => {
    const out = redactValue({
      meta: { password: "p", note: "ok" },
      list: ["postgres://u:p@h/db"],
    }) as { meta: Record<string, unknown>; list: string[] };
    expect(out.meta.password).toBe(REDACTED);
    expect(out.meta.note).toBe("ok");
    expect(out.list[0]).toContain("[redacted]");
  });
});

describe("redactDetails — flat diagnostic detail records", () => {
  it("preserves primitive shape and drops undefined", () => {
    const out = redactDetails({ failed: 3, ok: true, apiKey: "secret", missing: undefined });
    expect(out).toEqual({ failed: 3, ok: true, apiKey: REDACTED });
  });
});
