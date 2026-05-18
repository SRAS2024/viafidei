/**
 * Spec-pin test for the BuildOutcomeKind type union.
 *
 * The spec lists exactly seven outcomes a builder may return:
 *
 *   built_complete_package
 *   build_failed_missing_required_fields
 *   wrong_content
 *   source_not_allowed
 *   duplicate
 *   not_supported_by_source
 *   source_exhausted
 *
 * Only built_complete_package may continue to strict QA.
 *
 * This test parses the BuildOutcomeKind union in types.ts and asserts:
 *   * Every spec-required outcome appears in the union.
 *   * No outcomes beyond the spec set are present (catches a future
 *     extension that wasn't accompanied by a spec update).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TYPES_SRC = readFileSync(
  join(process.cwd(), "src", "lib", "content-factory", "types.ts"),
  "utf8",
);

const SPEC_OUTCOMES = [
  "built_complete_package",
  "build_failed_missing_required_fields",
  "wrong_content",
  "source_not_allowed",
  "duplicate",
  "not_supported_by_source",
  "source_exhausted",
] as const;

function buildOutcomeUnion(): string {
  // Capture the type alias body up to its terminating semicolon.
  const match = /export type BuildOutcomeKind\s*=([\s\S]*?);/.exec(TYPES_SRC);
  if (!match) throw new Error("BuildOutcomeKind type alias not found in types.ts");
  return match[1]!;
}

function unionMembers(body: string): string[] {
  // Extract every quoted string literal — the union is `| "a" | "b" | ...`.
  const out: string[] = [];
  const re = /"([a-zA-Z_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.push(m[1]!);
  return out;
}

describe("BuildOutcomeKind contains every spec-required outcome", () => {
  const members = unionMembers(buildOutcomeUnion());

  for (const outcome of SPEC_OUTCOMES) {
    it(`includes ${outcome}`, () => {
      expect(members).toContain(outcome);
    });
  }
});

describe("BuildOutcomeKind contains no extras beyond the spec set", () => {
  it("every member is in SPEC_OUTCOMES", () => {
    const members = unionMembers(buildOutcomeUnion());
    for (const m of members) {
      expect(SPEC_OUTCOMES as readonly string[]).toContain(m);
    }
  });

  it("the union has exactly the spec's count", () => {
    const members = unionMembers(buildOutcomeUnion());
    expect(new Set(members).size).toBe(SPEC_OUTCOMES.length);
  });
});

describe("Spec invariant: only built_complete_package continues to strict QA", () => {
  // This is a documentation pin — the spec says only this one outcome
  // continues. The runtime invariant is enforced in factory.ts:
  // any outcome ≠ built_complete_package short-circuits before QA.
  it("built_complete_package is the only spec-listed 'continue' outcome", () => {
    const terminals: string[] = SPEC_OUTCOMES.filter((o) => o !== "built_complete_package");
    // Every non-built outcome is a TERMINAL outcome (logged, possibly
    // deleted, never passed to QA). Spec count must be 6 terminals + 1
    // continue = 7 total.
    expect(terminals).toHaveLength(SPEC_OUTCOMES.length - 1);
    expect(terminals).toContain("build_failed_missing_required_fields");
    expect(terminals).toContain("wrong_content");
    expect(terminals).toContain("source_not_allowed");
    expect(terminals).toContain("duplicate");
    expect(terminals).toContain("not_supported_by_source");
    expect(terminals).toContain("source_exhausted");
  });
});
