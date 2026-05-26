/**
 * Memory decay (spec §15). Verifies the decay formula and the
 * audit listing.
 */

import { describe, expect, it } from "vitest";

import { decayedConfidence } from "@/lib/admin-worker/memory";

describe("decayedConfidence — half-life decay (spec §15)", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("returns full confidence when lastUsedAt is now", () => {
    const r = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: now,
      now,
    });
    // 8 successes, 2 failures, Laplace +1/+1 → confidence ~ 9/12 = 0.75
    expect(r.confidence).toBeCloseTo(9 / 12, 2);
    expect(r.ageDays).toBe(0);
  });

  it("halves the effective counts after 30 days (half-life)", () => {
    const last = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const r = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: last,
      now,
    });
    expect(r.effectiveSuccess).toBeCloseTo(4, 1);
    expect(r.effectiveFailure).toBeCloseTo(1, 1);
    expect(r.ageDays).toBe(30);
  });

  it("quarters the counts after 60 days", () => {
    const last = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const r = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: last,
      now,
    });
    expect(r.effectiveSuccess).toBeCloseTo(2, 1);
    expect(r.effectiveFailure).toBeCloseTo(0.5, 1);
  });

  it("drifts confidence toward 0.5 (Laplace neutral) as age grows", () => {
    const fresh = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: now,
      now,
    });
    const oneYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const stale = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: oneYear,
      now,
    });
    // Fresh row sits at 0.75; year-old row drifted back toward 0.5.
    expect(fresh.confidence).toBeGreaterThan(stale.confidence);
    expect(stale.confidence).toBeLessThan(0.6);
  });

  it("treats null lastUsedAt as 'now' (no decay yet)", () => {
    const r = decayedConfidence({
      successCount: 5,
      failureCount: 1,
      lastUsedAt: null,
      now,
    });
    expect(r.ageDays).toBe(0);
  });
});
