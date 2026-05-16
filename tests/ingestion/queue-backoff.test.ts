import { describe, expect, it } from "vitest";
import {
  backoffDelayForAttempt,
  calculateRunAt,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
} from "@/lib/ingestion/queue/backoff";

describe("ingestion queue backoff", () => {
  it("never returns less than the base delay", () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = backoffDelayForAttempt(attempt);
      expect(delay).toBeGreaterThanOrEqual(DEFAULT_BACKOFF_BASE_MS);
    }
  });

  it("never exceeds the configured maximum (within jitter band)", () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const delay = backoffDelayForAttempt(attempt);
      // Allow 25% jitter above the exp cap.
      expect(delay).toBeLessThanOrEqual(DEFAULT_BACKOFF_MAX_MS * 1.5);
    }
  });

  it("grows roughly exponentially across early attempts", () => {
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const runs: number[] = [];
      for (let k = 0; k < 50; k++) runs.push(backoffDelayForAttempt(i));
      samples.push(runs.reduce((a, b) => a + b, 0) / runs.length);
    }
    // Each next attempt should be on average at least ~1.5x the previous
    // (the exact growth is 2x with ±25% jitter).
    expect(samples[1]).toBeGreaterThan(samples[0] * 1.4);
    expect(samples[2]).toBeGreaterThan(samples[1] * 1.4);
  });

  it("calculateRunAt returns a future timestamp", () => {
    const now = new Date("2026-05-16T00:00:00Z");
    const next = calculateRunAt(0, undefined, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("respects custom base + max overrides", () => {
    const delay = backoffDelayForAttempt(20, { baseMs: 100, maxMs: 500 });
    expect(delay).toBeLessThanOrEqual(500 * 1.5);
    expect(delay).toBeGreaterThanOrEqual(100);
  });
});
