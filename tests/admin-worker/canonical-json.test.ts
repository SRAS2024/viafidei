/**
 * canonicalJson is what the worker compares jsonb columns and hashes curated content
 * with: the same content under any key order is one text, and any real difference, at
 * any depth, is another.
 */
import { describe, expect, it } from "vitest";

import { canonicalJson } from "@/lib/admin-worker/canonical-json";

import { asStoredInJsonb } from "../helpers/jsonb-order";

describe("canonicalJson", () => {
  it("is one text for one content, whatever order its keys are in, at every depth", () => {
    const written = {
      title: "Begin",
      steps: [
        { order: 1, title: "Kneel", body: "Then pray.", more: { z: 1, a: [{ y: 2, b: 3 }] } },
      ],
    };
    const stored = asStoredInJsonb(written);
    expect(JSON.stringify(stored)).not.toBe(JSON.stringify(written));
    expect(canonicalJson(stored)).toBe(canonicalJson(written));
  });

  it("sees a difference at any depth", () => {
    const value = (body: string) => ({ steps: [{ more: { a: [{ b: body }] } }] });
    expect(canonicalJson(value("one"))).not.toBe(canonicalJson(value("two")));
  });

  it("keeps array order: the order of steps means something", () => {
    expect(canonicalJson([{ a: 1 }, { a: 2 }])).not.toBe(canonicalJson([{ a: 2 }, { a: 1 }]));
  });

  it("leaves out a key holding undefined, as a jsonb column does, and keeps a null", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
    expect(canonicalJson({ a: 1, b: null })).not.toBe(canonicalJson({ a: 1 }));
  });

  it("writes plain values as JSON does", () => {
    expect(canonicalJson(undefined)).toBeUndefined();
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("Ave")).toBe('"Ave"');
    expect(canonicalJson({ b: 1, a: [true, "x", null] })).toBe('{"a":[true,"x",null],"b":1}');
  });
});
