import { describe, expect, it } from "vitest";
import {
  validatePayload,
  sanitizePayload,
  isJobKind,
  JOB_KINDS,
  PRIORITY_DEFAULTS,
} from "@/lib/ingestion/queue/job-kinds";

describe("job kinds — validation", () => {
  it("accepts a valid source_ingest payload", () => {
    const result = validatePayload("source_ingest", {
      sourceId: "src1",
      adapterKey: "vatican.prayers",
      contentType: "Prayer",
      mode: "constant",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown job kind", () => {
    const result = validatePayload("not_a_real_kind", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Unknown job kind/);
    }
  });

  it("rejects an invalid source_ingest payload", () => {
    const result = validatePayload("source_ingest", { sourceId: "src1" });
    expect(result.ok).toBe(false);
  });

  it("accepts content_revalidate with 'all'", () => {
    const result = validatePayload("content_revalidate", { contentType: "all" });
    expect(result.ok).toBe(true);
  });

  it("isJobKind narrows the type for valid kinds", () => {
    expect(isJobKind("source_ingest")).toBe(true);
    expect(isJobKind("totally_made_up")).toBe(false);
  });

  it("every JOB_KIND has a PRIORITY_DEFAULTS entry", () => {
    for (const kind of JOB_KINDS) {
      expect(typeof PRIORITY_DEFAULTS[kind]).toBe("number");
    }
  });
});

describe("job kinds — payload sanitization", () => {
  it("redacts sensitive keys at the top level", () => {
    const out = sanitizePayload({ token: "abc123", url: "https://example.com" }) as Record<
      string,
      unknown
    >;
    expect(out.token).toBe("[REDACTED]");
    expect(out.url).toBe("https://example.com");
  });

  it("redacts nested sensitive keys", () => {
    const out = sanitizePayload({
      payload: { authorization: "Bearer xyz", contentType: "Prayer" },
    }) as Record<string, Record<string, string>>;
    expect(out.payload.authorization).toBe("[REDACTED]");
    expect(out.payload.contentType).toBe("Prayer");
  });

  it("redacts inside arrays", () => {
    const out = sanitizePayload({ entries: [{ password: "secret" }, { url: "ok" }] }) as Record<
      string,
      unknown[]
    >;
    expect((out.entries[0] as Record<string, string>).password).toBe("[REDACTED]");
    expect((out.entries[1] as Record<string, string>).url).toBe("ok");
  });

  it("leaves non-objects untouched", () => {
    expect(sanitizePayload(42)).toBe(42);
    expect(sanitizePayload(null)).toBe(null);
    expect(sanitizePayload("plain string")).toBe("plain string");
  });
});
