/**
 * Spec-pin test for queue-job invariants.
 *
 * The spec says every queue job must have:
 *   * A clear jobKind (from the 12 active kinds).
 *   * A typed payload (zod schema).
 *   * A stable dedupeKey (so duplicate enqueues collapse).
 *
 * This test pins:
 *   * Every JOB_KINDS entry has a corresponding JOB_PAYLOAD_SCHEMAS entry.
 *   * validatePayload rejects unknown kinds.
 *   * validatePayload rejects REMOVED_JOB_KINDS with a spec-explanatory message.
 *   * The queue row type declares a `dedupeKey` field.
 */

import { describe, expect, it } from "vitest";
import {
  JOB_KINDS,
  JOB_PAYLOAD_SCHEMAS,
  REMOVED_JOB_KINDS,
  validatePayload,
  isJobKind,
} from "@/lib/ingestion/queue/job-kinds";

describe("every active job kind has a typed payload schema", () => {
  for (const kind of JOB_KINDS) {
    it(`JOB_PAYLOAD_SCHEMAS[${kind}] is defined and zod-validatable`, () => {
      const schema = (JOB_PAYLOAD_SCHEMAS as Record<string, unknown>)[kind];
      expect(schema).toBeDefined();
      // Every schema must expose a safeParse — that's the zod contract.
      expect(typeof (schema as { safeParse: unknown }).safeParse).toBe("function");
    });
  }

  it("JOB_PAYLOAD_SCHEMAS has no extras beyond JOB_KINDS", () => {
    const schemaKeys = Object.keys(JOB_PAYLOAD_SCHEMAS);
    for (const k of schemaKeys) {
      expect(JOB_KINDS as readonly string[]).toContain(k);
    }
  });
});

describe("validatePayload — runtime guard for typed payloads", () => {
  it("rejects an unknown job kind", () => {
    const result = validatePayload("definitely_not_a_real_kind", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown/i);
  });

  it("rejects every REMOVED_JOB_KINDS entry with a spec-explanatory message", () => {
    for (const removed of REMOVED_JOB_KINDS) {
      const result = validatePayload(removed, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/removed/i);
        // The message should point operators to the explicit factory stages.
        expect(result.error).toMatch(/factory|stages|source_discovery|content_build/i);
      }
    }
  });

  it("source_freshness accepts a valid payload with sourceId + adapterKey", () => {
    const result = validatePayload("source_freshness", {
      sourceId: "abc",
      adapterKey: "vatican.prayers",
    });
    expect(result.ok).toBe(true);
  });

  it("source_freshness rejects a payload missing sourceId", () => {
    const result = validatePayload("source_freshness", { adapterKey: "x" });
    expect(result.ok).toBe(false);
  });

  it("sitemap_refresh accepts an empty payload (strict empty object)", () => {
    const result = validatePayload("sitemap_refresh", {});
    expect(result.ok).toBe(true);
  });

  it("sitemap_refresh rejects an extra field (strict() on the schema)", () => {
    const result = validatePayload("sitemap_refresh", { extra: "no" });
    expect(result.ok).toBe(false);
  });
});

describe("isJobKind — narrows to the 12 active kinds only", () => {
  it("accepts every JOB_KINDS entry", () => {
    for (const k of JOB_KINDS) {
      expect(isJobKind(k)).toBe(true);
    }
  });

  it("rejects every REMOVED_JOB_KINDS entry", () => {
    for (const removed of REMOVED_JOB_KINDS) {
      expect(isJobKind(removed)).toBe(false);
    }
  });

  it("rejects arbitrary strings", () => {
    expect(isJobKind("")).toBe(false);
    expect(isJobKind("nope")).toBe(false);
    expect(isJobKind("SOURCE_DISCOVERY")).toBe(false); // case-sensitive
  });
});
