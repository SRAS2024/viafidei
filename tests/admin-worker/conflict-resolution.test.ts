/**
 * Conflict and contradiction handling (spec §19).
 *
 * Pins: agreement is recognised, authority beats a weaker source, an equal
 * authority with a clearly newer statement supersedes, corroboration breaks a
 * tie, and a genuine standoff preserves BOTH claims and escalates instead of
 * silently keeping whichever page was read first.
 */
import { describe, expect, it } from "vitest";

import {
  conflictKey,
  normalizeClaim,
  resolveConflict,
  type ClaimCandidate,
} from "@/lib/admin-worker/conflict-resolution";

const vatican = (value: string, statedAt?: Date): ClaimCandidate => ({
  value,
  sourceUrl: "https://www.vatican.va/x",
  sourceHost: "www.vatican.va",
  authorityLevel: "VATICAN",
  statedAt: statedAt ?? null,
});

const community = (value: string, statedAt?: Date): ClaimCandidate => ({
  value,
  sourceUrl: "https://example.org/x",
  sourceHost: "example.org",
  authorityLevel: "COMMUNITY",
  statedAt: statedAt ?? null,
});

describe("resolveConflict", () => {
  it("recognises agreement across sources", () => {
    const verdict = resolveConflict("feastDay", [vatican("4 October"), community("4 october")]);
    expect(verdict.resolution).toBe("agreement");
    expect(verdict.needsReview).toBe(false);
    expect(verdict.confidence).toBeGreaterThan(0.9);
  });

  it("prefers the higher Catholic authority", () => {
    const verdict = resolveConflict("feastDay", [community("5 October"), vatican("4 October")]);
    expect(verdict.resolution).toBe("resolved-by-authority");
    expect(verdict.winner?.value).toBe("4 October");
    expect(verdict.needsReview).toBe(false);
  });

  it("treats a clearly newer statement of equal authority as superseding", () => {
    const verdict = resolveConflict("norm", [
      vatican("older norm", new Date("1990-01-01")),
      vatican("revised norm", new Date("2021-01-01")),
    ]);
    expect(verdict.resolution).toBe("superseded");
    expect(verdict.winner?.value).toBe("revised norm");
  });

  it("breaks a tie on corroboration when authority and date cannot", () => {
    const verdict = resolveConflict("patronage", [
      community("animals"),
      community("animals"),
      community("animals"),
      community("ecology"),
    ]);
    expect(verdict.resolution).toBe("resolved-by-corroboration");
    expect(verdict.winner?.value).toBe("animals");
  });

  it("escalates a genuine standoff instead of guessing", () => {
    const verdict = resolveConflict("birthYear", [
      vatican("1181"),
      { ...vatican("1182"), sourceHost: "press.vatican.va" },
    ]);
    expect(verdict.resolution).toBe("unresolved");
    expect(verdict.winner).toBeNull();
    expect(verdict.needsReview).toBe(true);
    // BOTH claims are preserved for the reviewer.
    expect(verdict.claims.map((c) => c.value).sort()).toEqual(["1181", "1182"]);
  });
});

describe("conflict identity", () => {
  it("normalises trivial formatting differences", () => {
    expect(normalizeClaim("  4 October ")).toBe(normalizeClaim("4-october"));
  });

  it("is stable for the same claim set regardless of order", () => {
    const a = conflictKey("feastDay", [vatican("1181"), community("1182")]);
    const b = conflictKey("feastDay", [community("1182"), vatican("1181")]);
    expect(a).toBe(b);
  });
});
