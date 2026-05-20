/**
 * Validation-source retry tests (spec §17).
 */

import { describe, expect, it } from "vitest";
import { withRetryBackoff } from "@/lib/content-factory/cross-source-evidence-retry";

describe("withRetryBackoff()", () => {
  it("succeeds on the first attempt when the loader returns a value", async () => {
    const result = await withRetryBackoff(async () => "body", {
      maxAttempts: 3,
      baseDelayMs: 0,
      sleep: async () => undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("body");
  });

  it("retries when the loader throws, then succeeds on a later attempt", async () => {
    let attempts = 0;
    const result = await withRetryBackoff(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("transient");
        return "body";
      },
      { maxAttempts: 5, baseDelayMs: 0, sleep: async () => undefined },
    );
    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  it("treats a null return as a failed attempt and retries", async () => {
    let attempts = 0;
    const result = await withRetryBackoff(
      async () => {
        attempts += 1;
        if (attempts < 2) return null;
        return "value";
      },
      { maxAttempts: 3, baseDelayMs: 0, sleep: async () => undefined },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("value");
  });

  it("returns a structured failure after exhausting attempts", async () => {
    const result = await withRetryBackoff(async () => null, {
      maxAttempts: 3,
      baseDelayMs: 0,
      sleep: async () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(3);
      expect(result.error).toMatch(/null|loader/);
    }
  });

  it("honours the maxDelayMs cap on exponential backoff", async () => {
    const slept: number[] = [];
    await withRetryBackoff(
      async () => {
        throw new Error("transient");
      },
      {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 2000,
        sleep: async (ms) => {
          slept.push(ms);
        },
      },
    );
    // Every delay must respect the maxDelayMs cap.
    for (const ms of slept) {
      expect(ms).toBeLessThanOrEqual(2000);
    }
  });
});
